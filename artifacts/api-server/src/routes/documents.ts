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

// All other routes require authentication
router.use(authenticateToken);

// Matriz documental completa baseada na ISO 9001:2015
const DOCUMENT_TYPES = [
  // Estrutura do SGQ
  { type: "sgq_escopo", label: "SGQ-01 Escopo do SGQ" },
  { type: "sgq_mapa", label: "SGQ-02 Mapa de Processos" },
  { type: "sgq_politica", label: "SGQ-03 Política da Qualidade" },
  { type: "sgq_objetivos", label: "SGQ-04 Objetivos da Qualidade" },
  // Procedimentos
  { type: "pq_documentos", label: "PQ-01 Controle de Documentos e Registros" },
  { type: "pq_nao_conformidade", label: "PQ-02 Controle de Não Conformidade e Ação Corretiva" },
  { type: "pq_auditoria", label: "PQ-03 Auditoria Interna" },
  { type: "pq_analise_critica", label: "PQ-04 Análise Crítica pela Direção" },
  { type: "pq_produto_nao_conforme", label: "PQ-05 Controle de Produto Não Conforme" },
  { type: "pq_rastreabilidade", label: "PQ-06 Rastreabilidade de Produção" },
  { type: "pq_inspecao", label: "PQ-07 Inspeção e Controle da Qualidade" },
  // Formulários
  { type: "fq_lista_mestra", label: "FQ-01 Lista Mestra de Documentos" },
  { type: "fq_nao_conformidade", label: "FQ-02 Registro de Não Conformidade" },
  { type: "fq_auditoria", label: "FQ-03 Registro de Auditoria Interna" },
  { type: "fq_ordem_producao", label: "FQ-04 Ordem de Produção" },
  { type: "fq_inspecao", label: "FQ-05 Registro de Inspeção" },
  { type: "fq_treinamento", label: "FQ-06 Registro de Treinamento" },
  // Registros
  { type: "op_producao", label: "OP-2026-001 Ordem de Produção" },
  { type: "rq_inspecao", label: "RQ-01 Registro de Inspeção (Resultados)" },
  { type: "rq_retrabalho", label: "RQ-02 Registro de Retrabalho e Sucata" },
  { type: "rt_treinamento", label: "RT-01 Registro de Treinamento" },
  { type: "rt_lista_presenca", label: "RT-02 Lista de Presença" },
  { type: "rt_matriz_competencia", label: "RT-03 Matriz de Competência" },
  { type: "rc_calibracao", label: "RC-01 Registro de Calibração" },
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

        const prompt = `Você é um consultor líder ISO 9001:2015 com vasta experiência em implementação e auditoria de certificação em empresas de manufatura, metalurgia e indústria em geral.

**FASE 1: DIAGNÓSTICO E PLANEJAMENTO (OBRIGATÓRIO)**

Antes de gerar qualquer documento, você DEVE realizar o seguinte diagnóstico da empresa:

1. **Contexto Organizacional**
   - Identificar as partes interessadas relevantes (clientes, fornecedores, órgãos reguladores, colaboradores)
   - Mapear as necessidades e expectativas de cada parte interessada
   - Identificar fatores internos e externos que impactam a qualidade

2. **Mapa de Processos**
   - Descrever detalhadamente o fluxograma de processos da empresa
   - Identificar processos principais, de suporte e gerenciais
   - Definir entradas, saídas, fornecedores e clientes de cada processo

3. **Matriz de Riscos e Oportunidades**
   - Listar riscos associados a cada processo (com probabilidade e impacto)
   - Propor ações de mitigação para riscos críticos
   - Identificar oportunidades de melhoria (redução de custos, aumento de eficiência, etc.)

4. **Objetivos da Qualidade**
   - Definir KPIs mensuráveis por processo (ex: taxa de defeitos < 2%, OEE > 85%, etc.)
   - Estabelecer metas quantitativas e prazos para cada objetivo
   - Alinhar objetivos com a Política da Qualidade

**FASE 2: GERAÇÃO DE DOCUMENTOS**

Com base no diagnóstico acima, gere UM ÚNICO DOCUMENTO COMPLETO PARA CADA ITEM da matriz documental obrigatória.

Tipo do documento: "${typeLabel}"
Norma: ${standard.code} - ${standard.name}

**ESTRUTURA OBRIGATÓRIA PARA CADA DOCUMENTO:**

**CABEÇALHO INSTITUCIONAL**
- Empresa: ${company.name}
- Título do Documento: "${typeLabel}"
- Código do Documento (conforme matriz)
- Revisão: 00
- Data de Emissão: [data atual]
- Próxima Revisão: [data atual + 1 ano]

**CORPO DO DOCUMENTO (mínimo 2000 caracteres)**

1. OBJETIVO
   Descrever claramente o propósito do documento, alinhado com a ISO 9001:2015

2. ESCOPO
   Definir a abrangência do documento (processos, áreas, produtos/serviços)

3. RESPONSABILIDADES
   - Quem elabora, quem revisa, quem aprova
   - Responsabilidades específicas por cargo/função

4. DEFINIÇÕES E SIGLAS
   Glossário técnico com todos os termos relevantes

5. DESCRIÇÃO DETALHADA
   - Como o processo/função é executado
   - Sequência de atividades (passo a passo)
   - Critérios de entrada e saída

6. FLUXO DO PROCESSO
   - Descrição narrativa do fluxograma
   - Pontos de decisão e alternativas
   - Interfaces com outros processos

7. INDICADORES DE DESEMPENHO
   - Métricas específicas para monitoramento
   - Frequência de medição
   - Metas quantitativas
   - Responsável pela coleta

8. REGISTROS ASSOCIADOS
   - Documentos gerados como evidência
   - Formulários utilizados
   - Local de armazenamento e tempo de retenção

9. REFERÊNCIAS NORMATIVAS
   - Itens específicos da ISO 9001:2015
   - Legislação aplicável
   - Documentos correlacionados do SGQ

10. HISTÓRICO DE REVISÕES
    - Data, descrição da alteração, autor

11. APROVAÇÃO
    - Nome e cargo do aprovador
    - Assinatura (descritiva)

**REQUISITOS DE QUALIDADE:**

1. Coerência documental: todos os documentos devem se referenciar e criar um sistema integrado
2. Utilizar os dados reais da empresa: ${company.name}, Setor: ${company.sector}, Porte: ${company.size}, ${standard.code}
3. Linguagem técnica e profissional, mas acessível
4. Conteúdo prático e aplicável, com exemplos concretos
5. Profundidade compatível com consultoria de R$ 15.000 a R$ 30.000
6. Mínimo de 2000 caracteres por documento

**IMPORTANTE:** 
- Gere os documentos em português do Brasil
- Utilize dados fictícios coerentes com o setor (ex: produtos específicos, equipamentos, etc.)
- Inclua números de processos, códigos de produtos e dados realistas
- Documentos devem estar prontos para implementação imediata

${diagnosticContext ? `**CONTEXTO DO DIAGNÓSTICO:**
${diagnosticContext}` : ""}`;

        const content = await chat([
          { role: "system", content: "Você é um especialista em normas ISO com 20 anos de experiência na implementação de sistemas de gestão." },
          { role: "user", content: prompt },
        ]);

        const title = `${typeLabel} - ${standard.code}`;

        // Delete existing document for this company/standard/type (replace mode)
        await db
          .delete(documentsTable)
          .where(
            and(
              eq(documentsTable.companyId, companyId),
              eq(documentsTable.standardId, standardId),
              eq(documentsTable.type, docType),
            ),
          );

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

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));

  if (!doc) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  // Send file directly as download response
  const safeTitle = doc.title.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const filename = `${safeTitle}_v${doc.version}.html`;
  const content = doc.content || "";

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    @page { margin: 2.5cm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; padding: 2.5cm; }
    h1 { font-size: 22pt; margin-bottom: 0.5cm; color: #000; }
    h2 { font-size: 16pt; margin-top: 0.8cm; margin-bottom: 0.3cm; color: #333; }
    h3 { font-size: 13pt; margin-top: 0.5cm; margin-bottom: 0.2cm; color: #444; }
    p { margin-bottom: 0.3cm; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; }
    th, td { border: 1px solid #999; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    .header { text-align: center; margin-bottom: 1cm; border-bottom: 2px solid #333; }
    .meta { font-size: 10pt; color: #666; }
    .footer { margin-top: 1cm; border-top: 1px solid #ccc; font-size: 9pt; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${doc.title}</h1>
    <div class="meta"><p>Versão: ${doc.version} | Status: ${doc.status}</p></div>
  </div>
  ${content.split("\n").map(line => {
    const t = line.trim();
    if (!t) return "<p>&nbsp;</p>";
    if (t.startsWith("# ")) return "<h1>" + t.slice(2) + "</h1>";
    if (t.startsWith("## ")) return "<h2>" + t.slice(3) + "</h2>";
    if (t.startsWith("### ")) return "<h3>" + t.slice(4) + "</h3>";
    if (t.startsWith("- ") || t.startsWith("* ")) return "<li>" + t.slice(2) + "</li>";
    return "<p>" + t + "</p>";
  }).join("\n")}
  <div class="footer">
    <p>Documento gerado pelo Iso AI Guide</p>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(htmlContent);

  await logAudit(req, "document.download", "document", params.data.id);
});


// Get job status for progress polling
router.get("/jobs/:id", async (req, res): Promise<void> => {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, req.params.id));

  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }

  res.json(job);
});

export default router;
