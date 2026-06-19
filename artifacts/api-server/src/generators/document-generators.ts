import { db, documentsTable, documentRevisionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { chat } from "../lib/openrouter";
import { logger } from "../lib/logger";
import { GeneratorContext, buildHeader, buildSystemPrompt, DOCUMENT_SECTIONS } from "./base";

// ─── ISO 9001:2015 Document Matrix ───────────────────────────────────────────
export const DOCUMENT_MATRIX = {
  "SGQ-01": { name: "Escopo do Sistema de Gestão da Qualidade", section: "Estrutura do SGQ", type: "SGQ" },
  "SGQ-02": { name: "Mapa de Processos", section: "Estrutura do SGQ", type: "SGQ" },
  "SGQ-03": { name: "Política da Qualidade", section: "Estrutura do SGQ", type: "SGQ" },
  "SGQ-04": { name: "Objetivos da Qualidade", section: "Estrutura do SGQ", type: "SGQ" },
  "PQ-01":  { name: "Controle de Documentos e Registros", section: "Procedimentos", type: "PQ" },
  "PQ-02":  { name: "Controle de Não Conformidade e Ação Corretiva", section: "Procedimentos", type: "PQ" },
  "PQ-03":  { name: "Auditoria Interna", section: "Procedimentos", type: "PQ" },
  "PQ-04":  { name: "Análise Crítica pela Direção", section: "Procedimentos", type: "PQ" },
  "PQ-05":  { name: "Controle de Produto Não Conforme", section: "Procedimentos", type: "PQ" },
  "PQ-06":  { name: "Rastreabilidade de Produção", section: "Procedimentos", type: "PQ" },
  "PQ-07":  { name: "Inspeção e Controle da Qualidade", section: "Procedimentos", type: "PQ" },
  "FQ-01":  { name: "Lista Mestra de Documentos", section: "Formulários", type: "FQ" },
  "FQ-02":  { name: "Registro de Não Conformidade", section: "Formulários", type: "FQ" },
  "FQ-03":  { name: "Registro de Auditoria Interna", section: "Formulários", type: "FQ" },
  "FQ-04":  { name: "Ordem de Produção", section: "Formulários", type: "FQ" },
  "FQ-05":  { name: "Formulário de Inspeção", section: "Formulários", type: "FQ" },
  "FQ-06":  { name: "Formulário de Treinamento", section: "Formulários", type: "FQ" },
  "RQ-01":  { name: "Registro de Inspeção da Qualidade", section: "Registros", type: "RQ" },
  "RQ-02":  { name: "Registro de Retrabalho e Sucata", section: "Registros", type: "RQ" },
  "RT-01":  { name: "Registro de Treinamento", section: "Registros", type: "RT" },
  "RT-02":  { name: "Lista de Presença", section: "Registros", type: "RT" },
  "RT-03":  { name: "Matriz de Competência", section: "Registros", type: "RT" },
  "RC-01":  { name: "Registro de Calibração", section: "Registros", type: "RC" },
} as const;

export type DocumentCode = keyof typeof DOCUMENT_MATRIX;

// ─── Cross-reference map ──────────────────────────────────────────────────────
const CROSS_REFERENCES: Record<string, string[]> = {
  "SGQ-01": ["SGQ-02", "SGQ-03"],
  "SGQ-02": ["SGQ-01", "PQ-01"],
  "SGQ-03": ["SGQ-04", "PQ-04"],
  "SGQ-04": ["SGQ-03", "PQ-01", "RQ-01"],
  "PQ-01":  ["SGQ-01", "FQ-01", "SGQ-04"],
  "PQ-02":  ["FQ-02", "PQ-03", "SGQ-03", "FQ-02"],
  "PQ-03":  ["FQ-03", "PQ-01", "PQ-04"],
  "PQ-04":  ["PQ-03", "SGQ-03", "SGQ-04"],
  "PQ-05":  ["RQ-02", "FQ-02", "PQ-02"],
  "PQ-06":  ["FQ-04", "RQ-01", "PQ-07"],
  "PQ-07":  ["RQ-01", "RC-01", "FQ-05", "PQ-05"],
  "FQ-01":  ["PQ-01", "SGQ-01"],
  "FQ-02":  ["PQ-02", "PQ-05"],
  "FQ-03":  ["PQ-03"],
  "FQ-04":  ["PQ-06", "RQ-01"],
  "FQ-05":  ["PQ-07", "RQ-01"],
  "FQ-06":  ["RT-01", "RT-02"],
  "RQ-01":  ["PQ-07", "FQ-05", "RC-01"],
  "RQ-02":  ["PQ-05", "FQ-02"],
  "RT-01":  ["RT-02", "RT-03", "FQ-06"],
  "RT-02":  ["RT-01"],
  "RT-03":  ["RT-01", "RT-02"],
  "RC-01":  ["PQ-07", "RQ-01"],
};

// ─── Agent definitions ────────────────────────────────────────────────────────
interface AgentDef {
  name: string;
  specialty: string;
  documents: DocumentCode[];
}

const AGENTS: AgentDef[] = [
  {
    name: "SGQAgent (Consultor de Sistema de Gestão)",
    specialty: "estruturação de Sistemas de Gestão da Qualidade ISO 9001:2015, escopo, política, objetivos e mapa de processos",
    documents: ["SGQ-01", "SGQ-02", "SGQ-03", "SGQ-04"],
  },
  {
    name: "DocumentAgent (Consultor de Documentação)",
    specialty: "controle de documentos e registros, lista mestra e gestão documental ISO 9001:2015",
    documents: ["PQ-01", "FQ-01"],
  },
  {
    name: "AuditAgent (Consultor de Auditoria)",
    specialty: "auditoria interna da qualidade ISO 9001:2015, planejamento e execução de auditorias, checklist e relatórios",
    documents: ["PQ-03", "FQ-03", "PQ-04"],
  },
  {
    name: "NonConformityAgent (Consultor de Não Conformidades)",
    specialty: "gestão de não conformidades, ações corretivas, análise de causa raiz e produto não conforme ISO 9001:2015",
    documents: ["PQ-02", "PQ-05", "FQ-02", "RQ-02"],
  },
  {
    name: "RiskAgent (Consultor de Riscos e Produção)",
    specialty: "gestão de riscos, rastreabilidade, inspeção e controle da qualidade na produção ISO 9001:2015",
    documents: ["PQ-06", "PQ-07", "FQ-04", "FQ-05", "RQ-01"],
  },
  {
    name: "TrainingAgent (Consultor de Treinamento)",
    specialty: "gestão de treinamento, competências, habilidades e certificações ISO 9001:2015",
    documents: ["RT-01", "RT-02", "RT-03", "FQ-06"],
  },
  {
    name: "CalibrationAgent (Consultor de Calibração)",
    specialty: "calibração de equipamentos de medição e monitoramento ISO 9001:2015",
    documents: ["RC-01"],
  },
];

// ─── Individual document generators ──────────────────────────────────────────

export async function generateSingleDocument(
  ctx: GeneratorContext,
  documentCode: DocumentCode,
): Promise<string> {
  const docInfo = DOCUMENT_MATRIX[documentCode];
  if (!docInfo) throw new Error(`Código de documento inválido: ${documentCode}`);

  const agent = AGENTS.find(a => a.documents.includes(documentCode))!;
  const references = CROSS_REFERENCES[documentCode] || [];
  const refDescriptions = references.map(r => {
    const info = DOCUMENT_MATRIX[r as DocumentCode];
    return info ? `${r} - ${info.name}` : r;
  });

  const systemPrompt = buildSystemPrompt(agent.name, agent.specialty);

  const diagnosticsContext = ctx.diagnostic ? `
**CONTEXTO DO DIAGNÓSTICO:**
${ctx.diagnostic.organizationalContext ? `Contexto Organizacional: ${ctx.diagnostic.organizationalContext.slice(0, 500)}` : ""}
${ctx.diagnostic.processMap ? `Processos: ${ctx.diagnostic.processMap.slice(0, 500)}` : ""}
${ctx.diagnostic.risksAndOpportunities ? `Riscos: ${ctx.diagnostic.risksAndOpportunities.slice(0, 500)}` : ""}
${ctx.diagnostic.qualityObjectives ? `Objetivos: ${ctx.diagnostic.qualityObjectives.slice(0, 500)}` : ""}
` : "";

  const userPrompt = `Você deve gerar o documento **${documentCode} - ${docInfo.name}**

**EMPRESA:**
- Nome: ${ctx.company.name}
- Setor: ${ctx.company.sector}
- Porte: ${ctx.company.size}
- Atividade: ${ctx.company.activity || "Não informada"}
${diagnosticsContext}

**DOCUMENTOS CORRELACIONADOS (referencie-os no texto):**
${refDescriptions.join("\n")}

**ESTRUTURA OBRIGATÓRIA (inclua TODAS as seções):**

1. **OBJETIVO** - Propósito do documento alinhado à ISO 9001:2015
2. **ESCOPO** - Abrangência nos processos, áreas, produtos/serviços
3. **RESPONSABILIDADES** - Quem elabora, revisa, aprova; responsabilidades por cargo
4. **DEFINIÇÕES E SIGLAS** - Glossário técnico completo
5. **DESCRIÇÃO DETALHADA** - Passo a passo do processo, critérios de entrada/saída
6. **FLUXO DO PROCESSO** - Descrição narrativa, pontos de decisão, interfaces
7. **INDICADORES DE DESEMPENHO** - Métricas, frequência, metas, responsável
8. **REGISTROS ASSOCIADOS** - Evidências geradas, formulários, armazenamento
9. **REFERÊNCIAS NORMATIVAS** - Itens ISO 9001:2015, legislação, documentos correlacionados
10. **HISTÓRICO DE REVISÕES** - Data, descrição, autor
11. **APROVAÇÃO** - Nome/cargo do aprovador

**REQUISITOS:**
- Mínimo de 1200 palavras
- Linguagem técnica e profissional, mas acessível
- Conteúdo prático e aplicável, com exemplos concretos do setor ${ctx.company.sector}
- Utilize dados coerentes com o porte ${ctx.company.size}
- Documento deve estar pronto para implementação imediata
- Todos os documentos correlacionados devem ser referenciados no texto`;

  logger.info({ documentCode, agent: agent.name }, "Generating document");

  const response = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { maxTokens: 8192 });

  return formatDocument(ctx, documentCode, docInfo.name, response);
}

function formatDocument(
  ctx: GeneratorContext,
  code: string,
  name: string,
  content: string,
): string {
  const header = buildHeader(ctx, `${code} - ${name}`, code);
  return `${header}\n${content}`;
}

// ─── Orchestrator: generate all documents for a company ──────────────────────

export async function generateAllDocuments(
  ctx: GeneratorContext,
  standardId: string,
  standardCode: string,
  matrixItems: Array<{ code: string; name: string; section: string; type: string }>,
): Promise<{ success: number; failed: number; results: Array<{ code: string; status: string; error?: string }> }> {
  const results: Array<{ code: string; status: string; error?: string }> = [];
  let success = 0;
  let failed = 0;

  for (const item of matrixItems) {
    try {
      const content = await generateSingleDocument(ctx, item.code as DocumentCode);
      
      // Save document to database
      const title = `${item.code} - ${item.name}`;
      
      const [doc] = await db
        .insert(documentsTable)
        .values({
          companyId: ctx.companyId,
          standardId,
          standardCode,
          type: item.type.toLowerCase(),
          title,
          content,
          version: "00",
          status: "rascunho",
        })
        .returning();

      results.push({ code: item.code, status: "completed" });
      success++;
      logger.info({ code: item.code, docId: doc?.id }, "Document saved");
    } catch (err) {
      logger.error({ err, code: item.code }, "Document generation failed");
      results.push({ code: item.code, status: "failed", error: String(err) });
      failed++;
    }
  }

  return { success, failed, results };
}
