import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, diagnosticsTable, companiesTable } from "@workspace/db";
import { CreateDiagnosticBody, ListDiagnosticsQueryParams, GetDiagnosticParams } from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { generateDiagnostic, indexDiagnostic } from "../generators";

const router = Router();

router.use(authenticateToken);

router.post("/diagnostics", async (req, res): Promise<void> => {
  const parsed = CreateDiagnosticBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyId, additionalInfo } = parsed.data as {
    companyId: string;
    additionalInfo?: string;
  };

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.ownerId, req.user!.userId)));

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  // Create diagnostic record
  const [diagnostic] = await db
    .insert(diagnosticsTable)
    .values({
      companyId,
      status: "generating",
      additionalInfo: additionalInfo ?? null,
    })
    .returning();

  res.status(201).json(diagnostic);

  // Use the enhanced modular generator
  generateDiagnostic({ companyId, additionalInfo });

  await logAudit(req, "diagnostic.create", "diagnostic", diagnostic?.id);
});

router.get("/diagnostics", async (req, res): Promise<void> => {
  const params = ListDiagnosticsQueryParams.safeParse(req.query);
  const companyId = params.success ? params.data.companyId : undefined;

  const diagnostics = await db
    .select()
    .from(diagnosticsTable)
    .where(companyId ? eq(diagnosticsTable.companyId, companyId) : undefined)
    .orderBy(desc(diagnosticsTable.createdAt));

  res.json(diagnostics);
});

router.get("/diagnostics/:id", async (req, res): Promise<void> => {
  const params = GetDiagnosticParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [diagnostic] = await db
    .select()
    .from(diagnosticsTable)
    .where(eq(diagnosticsTable.id, params.data.id));

  if (!diagnostic) {
    res.status(404).json({ error: "Diagnóstico não encontrado" });
    return;
  }

  res.json(diagnostic);
});

export default router;
