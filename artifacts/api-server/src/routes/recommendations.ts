import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable, standardsTable, companyStandardsTable } from "@workspace/db";
import { authenticateToken } from "../middlewares/auth";
import { chat } from "../lib/openrouter";
import { logger } from "../lib/logger";

const router = Router();

router.use(authenticateToken);

router.get("/recommendations", async (req, res): Promise<void> => {
  const companyId = req.query.companyId as string | undefined;

  if (!companyId) {
    res.status(400).json({ error: "companyId é obrigatório" });
    return;
  }

  const company = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  if (!company[0]) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  const allStandards = await db.select().from(standardsTable);

  const selectedRows = await db
    .select({ standardId: companyStandardsTable.standardId })
    .from(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId));

  const selectedIds = new Set(selectedRows.map((r) => r.standardId));

  const co = company[0];
  const standardsList = allStandards
    .map((s) => `- ${s.code}: ${s.name} (${s.category}) — Setores: ${(s.applicableSectors ?? []).join(", ")}`)
    .join("\n");

  const alreadySelected = allStandards
    .filter((s) => selectedIds.has(s.id))
    .map((s) => s.code)
    .join(", ") || "Nenhuma ainda";

  const prompt = `Você é um consultor especialista em certificações ISO para empresas brasileiras. Analise o perfil abaixo e gere recomendações personalizadas.

PERFIL DA EMPRESA:
- Nome: ${co.name}
- Setor: ${co.sector}
- Porte: ${co.size}
- Atividade principal: ${co.activity ?? "Não informado"}
- Descrição: ${co.description ?? "Não informado"}

NORMAS ISO DISPONÍVEIS NA PLATAFORMA:
${standardsList}

NORMAS JÁ SELECIONADAS PELA EMPRESA: ${alreadySelected}

TAREFA: Gere recomendações de quais normas ISO essa empresa deveria priorizar, baseando-se no setor, porte e atividade dela. Para cada norma recomendada, explique o motivo de forma clara e objetiva (sem jargões técnicos) e liste 3 ações concretas que a empresa deve tomar para iniciar a implementação.

RESPONDA APENAS com um JSON válido no formato abaixo, sem texto antes ou depois:
{
  "summary": "Um parágrafo resumindo o panorama geral e as prioridades para essa empresa específica (2-3 frases em português, tom amigável e direto).",
  "recommendations": [
    {
      "standardCode": "ISO XXXX",
      "standardName": "Nome da norma",
      "priority": "alta" | "media" | "baixa",
      "reason": "Por que essa norma é importante para essa empresa específica (1-2 frases, linguagem simples).",
      "actions": [
        "Ação concreta 1 para começar",
        "Ação concreta 2 para começar",
        "Ação concreta 3 para começar"
      ]
    }
  ]
}

Ordene as recomendações por prioridade (alta primeiro). Inclua de 2 a 4 normas.`;

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "Você é um consultor especialista em certificações ISO. Responda sempre em português do Brasil, com linguagem clara e acessível. Retorne APENAS JSON válido.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.4, maxTokens: 1500 },
    );

    let parsed: {
      summary: string;
      recommendations: Array<{
        standardCode: string;
        standardName: string;
        priority: string;
        reason: string;
        actions: string[];
      }>;
    };

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      logger.error({ raw }, "Failed to parse recommendations JSON");
      res.status(500).json({ error: "Falha ao processar recomendações da IA" });
      return;
    }

    res.json({
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Recommendations generation failed");
    res.status(500).json({ error: "Erro ao gerar recomendações" });
  }
});

export default router;
