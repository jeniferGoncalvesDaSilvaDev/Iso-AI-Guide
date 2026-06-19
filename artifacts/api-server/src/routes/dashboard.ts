import { Router } from "express";
import { eq, count, desc } from "drizzle-orm";
import {
  db,
  documentsTable,
  companyStandardsTable,
  standardsTable,
  diagnosticsTable,
  auditLogsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetRecentActivityQueryParams,
  GetDocumentStatsQueryParams,
} from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.use(authenticateToken);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  const companyId = params.success ? params.data.companyId : undefined;

  let allDocs = companyId
    ? await db.select().from(documentsTable).where(eq(documentsTable.companyId, companyId))
    : await db.select().from(documentsTable);

  const totalDocuments = allDocs.length;
  const approvedDocuments = allDocs.filter((d) => d.status === "aprovado").length;
  const pendingDocuments = allDocs.filter((d) => d.status === "em_revisao").length;
  const draftDocuments = allDocs.filter((d) => d.status === "rascunho").length;

  const standards = companyId
    ? await db.select().from(companyStandardsTable).where(eq(companyStandardsTable.companyId, companyId))
    : await db.select().from(companyStandardsTable);

  const lastDiag = companyId
    ? await db
        .select()
        .from(diagnosticsTable)
        .where(eq(diagnosticsTable.companyId, companyId))
        .orderBy(desc(diagnosticsTable.createdAt))
        .limit(1)
    : [];

  const complianceScore =
    totalDocuments > 0 ? Math.round((approvedDocuments / totalDocuments) * 100) : null;

  res.json({
    totalDocuments,
    approvedDocuments,
    pendingDocuments,
    draftDocuments,
    selectedStandards: standards.length,
    lastDiagnosticDate: lastDiag[0]?.createdAt?.toISOString() ?? null,
    complianceScore,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const { companyId, limit } = params.success ? params.data : { companyId: undefined, limit: undefined };

  let query = db.select().from(auditLogsTable).$dynamic();
  if (companyId) query = query.where(eq(auditLogsTable.companyId, companyId));

  const logs = await query
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit ?? 10);

  const actionLabels: Record<string, string> = {
    "user.register": "Novo usuário registrado",
    "user.login": "Login realizado",
    "user.logout": "Logout realizado",
    "company.create": "Empresa criada",
    "company.update": "Empresa atualizada",
    "company.delete": "Empresa removida",
    "diagnostic.create": "Diagnóstico gerado",
    "documents.generate": "Documentos gerados",
    "document.update": "Documento atualizado",
    "document.download": "Documento baixado",
    "document.delete": "Documento removido",
  };

  res.json(
    logs.map((log) => ({
      id: log.id,
      type: log.action,
      description: actionLabels[log.action] ?? log.action,
      resourceId: log.resourceId ?? null,
      resourceType: log.resourceType ?? null,
      createdAt: log.createdAt,
    })),
  );
});

router.get("/dashboard/document-stats", async (req, res): Promise<void> => {
  const params = GetDocumentStatsQueryParams.safeParse(req.query);
  const companyId = params.success ? params.data.companyId : undefined;

  const standards = await db.select().from(standardsTable);

  const stats = await Promise.all(
    standards.map(async (standard) => {
      let docs = companyId
        ? await db
            .select()
            .from(documentsTable)
            .where(eq(documentsTable.companyId, companyId))
        : await db.select().from(documentsTable);

      docs = docs.filter((d) => d.standardId === standard.id);

      return {
        standardCode: standard.code,
        standardName: standard.name,
        total: docs.length,
        approved: docs.filter((d) => d.status === "aprovado").length,
        pending: docs.filter((d) => d.status === "em_revisao").length,
        draft: docs.filter((d) => d.status === "rascunho").length,
      };
    }),
  );

  res.json(stats.filter((s) => s.total > 0));
});

export default router;
