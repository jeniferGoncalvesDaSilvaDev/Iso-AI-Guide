import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentRevisionsTable,
  companiesTable,
  standardsTable,
  diagnosticsTable,
  jobsTable,
} from "@workspace/db";
import {
  ListDocumentsQueryParams,
  GenerateDocumentsBody,
  GetDocumentParams,
  UpdateDocumentParams,
  UpdateDocumentBody,
  DeleteDocumentParams,
  GetDocumentRevisionsParams,
  DownloadDocumentParams,
  DownloadDocumentBody,
} from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { chat } from "../lib/openrouter";
import { logAudit } from "../lib/audit";

const router = Router();

router.use(authenticateToken);

const DOCUMENT_TYPES = [
  { type: "manual", label: "Manual do SGQ" },
  { type: "procedimento", label: "Procedimento Operacional" },
  { type: "registro", label: "Registro de Qualidade" },
  { type: "formulario", label: "Formulário" },
];

router.get("/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsQueryParams.safeParse(req.query);
  const { companyId, standardId, type } = params.success ? params.data : {};

  let query = db.select().from(documentsTable).$dynamic();

  const conditions = [];
  if (companyId) conditions.push(eq(documentsTable.companyId, companyId));
  if (standardId) conditions.push(eq(documentsTable.standardId, standardId));
  if (type) conditions.push(eq(documentsTable.type, type));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const documents = await query.orderBy(desc(documentsTable.createdAt));
  res.json(documents);
});

router.post("/documents/generate", async (req, res): Promise<void> => {
  const parsed = GenerateDocumentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyId, standardId, diagnosticId, documentTypes } = parsed.data as {
    companyId: string;
    standardId: string;
    diagnosticId?: string;
    documentTypes?: string[];
  };

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerId, req.user!.userId)));

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  const [standard] = await db
    .select()
    .from(standardsTable)
    .where(eq(standardsTable.id, standardId));

  if (!standard) {
    res.status(404).json({ error: "Norma não encontrada" });
    return;
  }

  const typesToGenerate = documentTypes ?? DOCUMENT_TYPES.map((d) => d.type);

  const [job] = await db
    .insert(jobsTable)
    .values({
      type: "generate_documents",
      status: "pending",
      companyId,
      totalDocuments: typesToGenerate.length,
      progress: 0,
      data: JSON.stringify({ companyId, standardId, diagnosticId }),
    })
    .returning();

  res.status(202).json({
    jobId: job!.id,
    status: "pending",
    message: "Iniciando geração dos seus documentos...",
    progress: 0,
    totalDocuments: typesToGenerate.length,
  });

  setImmediate(async () => {
    let progress = 0;
    try {
      await db.update(jobsTable).set({ status: "processing" }).where(eq(jobsTable.id, job!.id));

      let diagnosticContext = "";
      if (diagnosticId) {
        const [diag] = await db
          .select()
          .from(diagnosticsTable)
          .where(eq(diagnosticsTable.id, diagnosticId));
        if (diag) {
          diagnosticContext = `
Diagnóstico organizacional:
- Contexto: ${diag.organizationalContext ?? ""}
- Partes Interessadas: ${diag.stakeholders ?? ""}
- Processos: ${diag.processMap ?? ""}
- Riscos: ${diag.risksAndOpportunities ?? ""}`;
        }
      }

      for (const docType of typesToGenerate) {
        const typeLabel = DOCUMENT_TYPES.find((d) => d.type === docType)?.label ?? docType;

        const prompt = `Você é um especialista em normas ISO. Crie um documento completo e profissional do tipo "${typeLabel}" para a norma ${standard.code} - ${standard.name}.

Empresa: ${company.name}
Setor: ${company.sector}
Porte: ${company.size}
${diagnosticContext}

Crie o documento em português, seguindo todos os requisitos da norma ${standard.code}. O documento deve ser completo, com seções, subseções, exemplos práticos e aplicável à empresa descrita.

Inclua cabeçalho, escopo, definições, responsabilidades e o conteúdo principal.`;

        const content = await chat([
          { role: "system", content: "Você é um especialista em normas ISO com 20 anos de experiência na implementação de sistemas de gestão." },
          { role: "user", content: prompt },
        ]);

        const title = `${typeLabel} - ${standard.code}`;

        const existing = await db
          .select()
          .from(documentsTable)
          .where(
            and(
              eq(documentsTable.companyId, companyId),
              eq(documentsTable.standardId, standardId),
              eq(documentsTable.type, docType),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          const doc = existing[0]!;
          const currentVersion = parseInt(doc.version, 10);
          const newVersion = String(currentVersion + 1).padStart(2, "0");

          await db.insert(documentRevisionsTable).values({
            documentId: doc.id,
            version: doc.version,
            content: doc.content,
            revisionReason: "Regenerado pela IA",
            createdBy: req.user?.userId ?? null,
          });

          await db
            .update(documentsTable)
            .set({ content, version: newVersion, status: "rascunho" })
            .where(eq(documentsTable.id, doc.id));
        } else {
          await db.insert(documentsTable).values({
            companyId,
            standardId,
            standardCode: standard.code,
            type: docType,
            title,
            content,
            version: "00",
            status: "rascunho",
            createdBy: req.user?.userId ?? null,
          });
        }

        progress++;
        await db
          .update(jobsTable)
          .set({ progress })
          .where(eq(jobsTable.id, job!.id));
      }

      await db
        .update(jobsTable)
        .set({ status: "completed", progress: typesToGenerate.length })
        .where(eq(jobsTable.id, job!.id));
    } catch (err) {
      await db
        .update(jobsTable)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eq(jobsTable.id, job!.id));
    }
  });

  await logAudit(req, "documents.generate", "job", job?.id);
});

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));

  if (!doc) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  res.json(doc);
});

router.patch("/documents/:id", async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as {
    title?: string;
    content?: string;
    status?: string;
    revisionReason?: string;
  };

  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  if (data.content && data.content !== existing.content) {
    await db.insert(documentRevisionsTable).values({
      documentId: existing.id,
      version: existing.version,
      content: existing.content,
      revisionReason: data.revisionReason ?? "Atualização manual",
      createdBy: req.user?.userId ?? null,
    });

    const currentVersion = parseInt(existing.version, 10);
    const newVersion = String(currentVersion + 1).padStart(2, "0");

    const { revisionReason: _reason, ...updateFields } = data;
    const [updated] = await db
      .update(documentsTable)
      .set({ ...updateFields, version: newVersion })
      .where(eq(documentsTable.id, params.data.id))
      .returning();

    await logAudit(req, "document.update", "document", params.data.id);
    res.json(updated);
    return;
  }

  const { revisionReason: _reason, ...updateFields } = data;
  const [updated] = await db
    .update(documentsTable)
    .set(updateFields)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  await logAudit(req, "document.update", "document", params.data.id);
  res.json(updated);
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  await logAudit(req, "document.delete", "document", params.data.id);
  res.sendStatus(204);
});

router.get("/documents/:id/revisions", async (req, res): Promise<void> => {
  const params = GetDocumentRevisionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const revisions = await db
    .select()
    .from(documentRevisionsTable)
    .where(eq(documentRevisionsTable.documentId, params.data.id))
    .orderBy(desc(documentRevisionsTable.createdAt));

  res.json(revisions);
});

router.post("/documents/:id/download", async (req, res): Promise<void> => {
  const params = DownloadDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DownloadDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));

  if (!doc) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  const format = (parsed.data as { format: string }).format;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const filename = `${doc.title.replace(/\s+/g, "_")}_v${doc.version}.${format}`;

  await logAudit(req, "document.download", "document", params.data.id);

  res.json({
    url: `/api/documents/${doc.id}/file?format=${format}&token=${Buffer.from(doc.id).toString("base64")}`,
    filename,
    expiresAt: expiresAt.toISOString(),
  });
});

export default router;
