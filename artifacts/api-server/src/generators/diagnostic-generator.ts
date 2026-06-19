import { db, diagnosticsTable, companiesTable, companyStandardsTable, standardsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { chat } from "../lib/openrouter";
import { logger } from "../lib/logger";
import { buildSystemPrompt } from "./base";

interface GenerateDiagnosticParams {
  companyId: string;
  additionalInfo?: string;
}

export async function generateDiagnostic(params: GenerateDiagnosticParams): Promise<void> {
  const { companyId, additionalInfo } = params;

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company) throw new Error("Empresa não encontrada");

  // Get selected standards
  const links = await db
    .select()
    .from(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId));

  let selectedStandards: string[] = [];
  if (links.length > 0) {
    const stds = await db
      .select({ code: standardsTable.code })
      .from(standardsTable)
      .where(inArray(standardsTable.id, links.map(l => l.standardId)));
    selectedStandards = stds.map((s) => s.code);
  }

  // Create diagnostic record
  const [diagnostic] = await db
    .insert(diagnosticsTable)
    .values({ companyId, status: "generating", additionalInfo: additionalInfo ?? null })
    .returning();

  const diagnosticId = diagnostic!.id;

  // Generate each section independently
  setImmediate(async () => {
    try {
      const baseContext = `Empresa: ${company.name}
Setor: ${company.sector}
Porte: ${company.size}
Atividade: ${company.activity ?? "Não informada"}
Descrição: ${company.description ?? "Não informada"}
Normas selecionadas: ${selectedStandards.join(", ") || "Nenhuma"}
${additionalInfo ? `Informações adicionais: ${additionalInfo}` : ""}`;

      // Generate organizational context
      logger.info({ diagnosticId }, "Generating organizational context");
      const organizationalContext = await generateSection(
        "Contexto Organizacional",
        `Com base nos dados abaixo, faça uma análise detalhada do CONTEXTO ORGANIZACIONAL da empresa.

${baseContext}

Estrutura obrigatória:
1. ANÁLISE INTERNA: Pontos fortes e fracos da empresa (recursos, capacidades, cultura organizacional)
2. ANÁLISE EXTERNA: Fatores políticos, econômicos, sociais, tecnológicos, legais e ambientais
3. PARTES INTERESSADAS: Liste no mínimo 8 partes interessadas relevantes (clientes, fornecedores, órgãos reguladores, colaboradores, sindicatos, comunidade, acionistas, concorrentes) com suas necessidades e expectativas específicas
4. FATORES CRÍTICOS DE SUCESSO: O que é essencial para o sucesso da empresa

Seja específico e prático, relacionando cada ponto ao setor de atuação da empresa.`,
      );

      // Generate process map
      logger.info({ diagnosticId }, "Generating process map");
      const processMap = await generateSection(
        "Mapa de Processos",
        `Com base nos dados abaixo, crie um MAPA DE PROCESSOS completo e detalhado.

${baseContext}
${organizationalContext ? `\nContexto identificado:\n${organizationalContext.slice(0, 1000)}` : ""}

Estrutura obrigatória:
1. PROCESSOS GERENCIAIS: Planejamento estratégico, análise crítica, auditoria interna, melhoria contínua
2. PROCESSOS PRINCIPAIS (FIM): Vendas, projeto/contrato, compras, produção/operação, entrega, pós-venda
3. PROCESSOS DE SUPORTE: RH/treinamento, manutenção, calibração, TI, financeiro, documentação

Para cada processo, descreva:
- Entradas e saídas
- Fornecedores e clientes (internos e externos)
- Indicadores de desempenho
- Inter-relação com outros processos

Descreva o fluxograma narrativo completo com as interações entre os processos.`,
      );

      // Generate risks and opportunities
      logger.info({ diagnosticId }, "Generating risks and opportunities");
      const risksAndOpportunities = await generateSection(
        "Riscos e Oportunidades",
        `Com base nos dados abaixo, elabore uma MATRIZ DE RISCOS E OPORTUNIDADES.

${baseContext}
${processMap ? `\nProcessos mapeados:\n${processMap.slice(0, 1000)}` : ""}

Estrutura obrigatória:
1. RISCOS POR PROCESSO: No mínimo 15 riscos identificados, cada um com:
   - Processo/área afetada
   - Descrição do risco
   - Probabilidade (1-5)
   - Impacto (1-5)
   - Nível de risco (probabilidade x impacto)
   - Ação de mitigação
   - Responsável

2. OPORTUNIDADES: No mínimo 8 oportunidades de melhoria, cada uma com:
   - Descrição da oportunidade
   - Benefício esperado (redução de custos, aumento de eficiência, etc.)
   - Prioridade (alta/média/baixa)
   - Prazo sugerido

Use uma tabela formatada para os riscos.`,
      );

      // Generate quality objectives
      logger.info({ diagnosticId }, "Generating quality objectives");
      const qualityObjectives = await generateSection(
        "Objetivos da Qualidade e KPIs",
        `Com base nos dados abaixo, defina OBJETIVOS DA QUALIDADE e KPIs mensuráveis.

${baseContext}
${risksAndOpportunities ? `\nRiscos identificados:\n${risksAndOpportunities.slice(0, 1000)}` : ""}

Estrutura obrigatória:
1. POLÍTICA DA QUALIDADE (minuta): Declaração formal do compromisso da empresa com a qualidade
2. OBJETIVOS E METAS: No mínimo 10 objetivos, cada um com:
   - Processo relacionado
   - Objetivo específico
   - KPI (indicador mensurável)
   - Meta quantitativa (ex: taxa de defeitos < 2%, OEE > 85%, entregas no prazo > 95%)
   - Frequência de medição
   - Responsável
   - Prazo para atingimento

3. ALINHAMENTO ESTRATÉGICO: Como cada objetivo se relaciona com a Política da Qualidade`,
      );

      // Generate recommendations
      logger.info({ diagnosticId }, "Generating recommendations");
      const recommendations = await generateSection(
        "Recomendações e Próximos Passos",
        `Com base em toda a análise anterior, gere RECOMENDAÇÕES e PRÓXIMOS PASSOS.

${baseContext}

Estrutura obrigatória:
1. PRIORIDADES IMEDIATAS (0-30 dias): Ações urgentes que a empresa deve tomar
2. CURTO PRAZO (30-90 dias): Implementações necessárias
3. MÉDIO PRAZO (90-180 dias): Consolidação do sistema
4. LONGO PRAZO (180-365 dias): Melhoria contínua e certificação

Para cada recomendação, inclua:
- Ação específica
- Recursos necessários
- Responsável sugerido
- Prazo estimado
- Prioridade

Seja prático e realista com os prazos.`,
      );

      // Save all sections
      await db
        .update(diagnosticsTable)
        .set({
          status: "completed",
          organizationalContext,
          stakeholders: "Ver contexto organizacional - análise de partes interessadas incluída.",
          processMap,
          risksAndOpportunities,
          qualityObjectives,
          recommendations,
        })
        .where(eq(diagnosticsTable.id, diagnosticId));

      logger.info({ diagnosticId }, "Diagnostic completed");
    } catch (err) {
      logger.error({ err, diagnosticId }, "Diagnostic generation failed");
      await db
        .update(diagnosticsTable)
        .set({ status: "failed" })
        .where(eq(diagnosticsTable.id, diagnosticId));
    }
  });
}

async function generateSection(sectionName: string, userPrompt: string): Promise<string> {
  const systemPrompt = buildSystemPrompt(
    `Consultor ISO para ${sectionName}`,
    `análise de ${sectionName} em sistemas de gestão da qualidade ISO 9001:2015`
  );

  const response = await chat([
    { role: "system", content: `${systemPrompt}\n\nGere um texto completo, detalhado e prático. Mínimo de 800 palavras. Use markdown para estruturar.` },
    { role: "user", content: userPrompt },
  ], { maxTokens: 4096 });

  return response;
}
