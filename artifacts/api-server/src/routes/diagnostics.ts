import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, diagnosticsTable, companiesTable, standardsTable, companyStandardsTable } from "@workspace/db";
import { CreateDiagnosticBody, ListDiagnosticsQueryParams, GetDiagnosticParams } from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { chat } from "../lib/openrouter";
import { logAudit } from "../lib/audit";

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

  const links = await db
    .select()
    .from(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId));

  const standardIds = links.map((l) => l.standardId);
  let selectedStandards: string[] = [];
  if (standardIds.length > 0) {
    const stds = await db
      .select({ code: standardsTable.code })
      .from(standardsTable)
      .where(eq(standardsTable.id, standardIds[0]!));
    selectedStandards = stds.map((s) => s.code);
  }

  const [diagnostic] = await db
    .insert(diagnosticsTable)
    .values({
      companyId,
      status: "generating",
      additionalInfo: additionalInfo ?? null,
    })
    .returning();

  res.status(201).json(diagnostic);

  setImmediate(async () => {
    try {
      const prompt = `Você é um especialista em sistemas de gestão ISO. Gere um diagnóstico organizacional completo para a seguinte empresa:

Empresa: ${company.name}
Setor: ${company.sector}
Porte: ${company.size}
Atividade: ${company.activity ?? "Não informada"}
Normas selecionadas: ${selectedStandards.join(", ") || "Não informadas"}
${additionalInfo ? `Informações adicionais: ${additionalInfo}` : ""}

Gere um diagnóstico detalhado em português com as seguintes seções:

1. CONTEXTO ORGANIZACIONAL: Análise do ambiente interno e externo da empresa
2. PARTES INTERESSADAS: Lista das principais partes interessadas e suas necessidades
3. MAPA DE PROCESSOS: Principais processos da empresa
4. RISCOS E OPORTUNIDADES: Principais riscos e oportunidades identificados
5. OBJETIVOS DA QUALIDADE: Objetivos recomendados baseados no diagnóstico
6. RECOMENDAÇÕES: Próximos passos e prioridades para implementação

Seja específico e prático. Use linguagem acessível.`;

      const response = await chat([
        { role: "system", content: "Você é um consultor especialista em normas ISO com 20 anos de experiência." },
        { role: "user", content: prompt },
      ]);

      const sections = response.split(/\n(?=\d+\.)/);

      const extract = (keyword: string): string => {
        const sec = sections.find((s) => s.toLowerCase().includes(keyword.toLowerCase()));
        return sec?.replace(/^\d+\.\s*[^\n]+\n/, "").trim() ?? "";
      };

      await db
        .update(diagnosticsTable)
        .set({
          status: "completed",
          organizationalContext: extract("contexto organizacional"),
          stakeholders: extract("partes interessadas"),
          processMap: extract("mapa de processos"),
          risksAndOpportunities: extract("riscos e oportunidades"),
          qualityObjectives: extract("objetivos da qualidade"),
          recommendations: extract("recomendações"),
        })
        .where(eq(diagnosticsTable.id, diagnostic!.id));
    } catch (err) {
      await db
        .update(diagnosticsTable)
        .set({ status: "failed" })
        .where(eq(diagnosticsTable.id, diagnostic!.id));
    }
  });

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
