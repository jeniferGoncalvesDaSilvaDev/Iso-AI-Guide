import { db, companiesTable, diagnosticsTable, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { chat } from "../lib/openrouter";

export interface GeneratorContext {
  companyId: string;
  company: {
    name: string;
    sector: string;
    size: string;
    activity?: string | null;
    description?: string | null;
  };
  diagnostic?: {
    organizationalContext?: string | null;
    stakeholders?: string | null;
    processMap?: string | null;
    risksAndOpportunities?: string | null;
    qualityObjectives?: string | null;
    recommendations?: string | null;
  } | null;
}

export interface GeneratorResult {
  success: boolean;
  content?: string;
  error?: string;
}

export const DOCUMENT_SECTIONS = [
  "OBJETIVO",
  "ESCOPO",
  "RESPONSABILIDADES",
  "DEFINIÇÕES E SIGLAS",
  "DESCRIÇÃO DETALHADA",
  "FLUXO DO PROCESSO",
  "INDICADORES DE DESEMPENHO",
  "REGISTROS ASSOCIADOS",
  "REFERÊNCIAS NORMATIVAS",
  "HISTÓRICO DE REVISÕES",
  "APROVAÇÃO",
];

export async function loadContext(companyId: string): Promise<GeneratorContext> {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company) throw new Error("Empresa não encontrada");

  const [diag] = await db
    .select()
    .from(diagnosticsTable)
    .where(eq(diagnosticsTable.companyId, companyId))
    .orderBy(diagnosticsTable.createdAt);

  return {
    companyId,
    company: {
      name: company.name,
      sector: company.sector,
      size: company.size,
      activity: company.activity,
      description: company.description,
    },
    diagnostic: diag || null,
  };
}

export function buildHeader(ctx: GeneratorContext, documentTitle: string, documentCode: string): string {
  return [
    "=".repeat(60),
    `${documentCode} - ${documentTitle}`,
    `Empresa: ${ctx.company.name}`,
    `Setor: ${ctx.company.sector}`,
    `Porte: ${ctx.company.size}`,
    `Revisão: 00`,
    `Data de Emissão: ${new Date().toLocaleDateString("pt-BR")}`,
    "=".repeat(60),
    "",
  ].join("\n");
}

export function buildSystemPrompt(agentName: string, specialty: string): string {
  return `Você é ${agentName}, um consultor especialista em ${specialty} com mais de 20 anos de experiência em implementação e auditoria de sistemas de gestão ISO. Responda sempre em português do Brasil, com linguagem técnica, clara e prática.`;
}
