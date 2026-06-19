import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, documentMatrixTable, documentsTable, companiesTable, companyStandardsTable, standardsTable } from "@workspace/db";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { DOCUMENT_MATRIX, generateSingleDocument, loadContext } from "../generators";
import { logger } from "../lib/logger";

const router = Router();
router.use(authenticateToken);

// Get document matrix for a company
router.get("/companies/:companyId/document-matrix", async (req, res): Promise<void> => {
  const companyId = req.params.companyId;

  // First try to get from database
  let matrix = await db
    .select()
    .from(documentMatrixTable)
    .where(eq(documentMatrixTable.companyId, companyId))
    .orderBy(documentMatrixTable.order);

  // If no matrix exists, create from template
  if (matrix.length === 0) {
    const entries = Object.entries(DOCUMENT_MATRIX).map(([code, info], index) => ({
      companyId,
      code,
      name: info.name,
      section: info.section,
      type: info.type,
      status: "pendente",
      revision: "00",
      order: index,
    }));

    matrix = await db
      .insert(documentMatrixTable)
      .values(entries)
      .returning()
      .then(r => r.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }

  // Enrich with document info if generated
  const enriched = await Promise.all(
    matrix.map(async (item) => {
      if (item.documentId) {
        const [doc] = await db
          .select({ id: documentsTable.id, status: documentsTable.status, version: documentsTable.version, createdAt: documentsTable.createdAt })
          .from(documentsTable)
          .where(eq(documentsTable.id, item.documentId));
        return { ...item, document: doc || null };
      }
      return { ...item, document: null };
    })
  );

  res.json(enriched);
});

// Generate a single document from the matrix
router.post("/document-matrix/:matrixId/generate", async (req, res): Promise<void> => {
  const matrixId = req.params.matrixId;

  const [matrixItem] = await db
    .select()
    .from(documentMatrixTable)
    .where(eq(documentMatrixTable.id, matrixId));

  if (!matrixItem) {
    res.status(404).json({ error: "Item da matriz não encontrado" });
    return;
  }

  // Update status
  await db
    .update(documentMatrixTable)
    .set({ status: "gerando" })
    .where(eq(documentMatrixTable.id, matrixId));

  res.status(202).json({ message: "Geração iniciada", matrixId });

  // Generate in background
  setImmediate(async () => {
    try {
      const ctx = await loadContext(matrixItem.companyId);
      
      const content = await generateSingleDocument(ctx, matrixItem.code as any);

      // Check if document already exists
      const [existingDoc] = await db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.id, matrixItem.documentId || ""));

      let docId: string;

      if (existingDoc) {
        // Create revision
        const currentVersion = parseInt(existingDoc.version, 10);
        const newVersion = String(currentVersion + 1).padStart(2, "0");

        await db.insert(documentsTable).values({
          companyId: matrixItem.companyId,
          standardId: matrixItem.standardId || undefined,
          standardCode: "ISO 9001:2015",
          type: matrixItem.type.toLowerCase(),
          title: `${matrixItem.code} - ${matrixItem.name}`,
          content,
          version: newVersion,
          status: "rascunho",
        });

        const [newDoc] = await db
          .select()
          .from(documentsTable)
          .where(eq(documentsTable.title, `${matrixItem.code} - ${matrixItem.name}`))
          .orderBy(documentsTable.createdAt)
          .limit(1);

        docId = newDoc!.id;
      } else {
        const [newDoc] = await db
          .insert(documentsTable)
          .values({
            companyId: matrixItem.companyId,
            standardId: matrixItem.standardId || undefined,
            standardCode: "ISO 9001:2015",
            type: matrixItem.type.toLowerCase(),
            title: `${matrixItem.code} - ${matrixItem.name}`,
            content,
            version: "00",
            status: "rascunho",
          })
          .returning();

        docId = newDoc!.id;
      }

      // Update matrix
      await db
        .update(documentMatrixTable)
        .set({ status: "concluido", documentId: docId, revision: "00" })
        .where(eq(documentMatrixTable.id, matrixId));

      // Index for RAG
      try {
        const { indexDocument } = await import("../generators/rag");
        await indexDocument(docId, matrixItem.companyId);
      } catch (e) {
        logger.warn({ e }, "Failed to index document");
      }

      await logAudit(req, "matrix.document.generate", "document", docId);
    } catch (err) {
      logger.error({ err, matrixId }, "Document generation failed");
      await db
        .update(documentMatrixTable)
        .set({ status: "erro" })
        .where(eq(documentMatrixTable.id, matrixId));
    }
  });
});

// Generate ALL pending documents for a company
router.post("/companies/:companyId/document-matrix/generate-all", async (req, res): Promise<void> => {
  const companyId = req.params.companyId;

  const pendingItems = await db
    .select()
    .from(documentMatrixTable)
    .where(
      and(
        eq(documentMatrixTable.companyId, companyId),
        inArray(documentMatrixTable.status, ["pendente", "erro"])
      )
    )
    .orderBy(documentMatrixTable.order);

  if (pendingItems.length === 0) {
    res.json({ message: "Nenhum documento pendente", total: 0 });
    return;
  }

  // Mark all as generating
  await db
    .update(documentMatrixTable)
    .set({ status: "gerando" })
    .where(
      and(
        eq(documentMatrixTable.companyId, companyId),
        inArray(documentMatrixTable.status, ["pendente", "erro"])
      )
    );

  res.status(202).json({
    message: `Gerando ${pendingItems.length} documentos`,
    total: pendingItems.length,
  });

  // Generate each document individually (sequential to avoid rate limits)
  setImmediate(async () => {
    try {
      const ctx = await loadContext(companyId);
      let success = 0;
      let failed = 0;

      for (const item of pendingItems) {
        try {
          const content = await generateSingleDocument(ctx, item.code as any);

          const [newDoc] = await db
            .insert(documentsTable)
            .values({
              companyId,
              standardId: item.standardId || undefined,
              standardCode: "ISO 9001:2015",
              type: item.type.toLowerCase(),
              title: `${item.code} - ${item.name}`,
              content,
              version: "00",
              status: "rascunho",
            })
            .returning();

          await db
            .update(documentMatrixTable)
            .set({ status: "concluido", documentId: newDoc!.id, revision: "00" })
            .where(eq(documentMatrixTable.id, item.id));

          success++;
        } catch (err) {
          logger.error({ err, code: item.code }, "Failed to generate document");
          await db
            .update(documentMatrixTable)
            .set({ status: "erro" })
            .where(eq(documentMatrixTable.id, item.id));
          failed++;
        }
      }

      await logAudit(req, "matrix.generate-all", "company", companyId);
      logger.info({ companyId, success, failed }, "Batch generation completed");
    } catch (err) {
      logger.error({ err, companyId }, "Batch generation failed");
    }
  });
});

export default router;
