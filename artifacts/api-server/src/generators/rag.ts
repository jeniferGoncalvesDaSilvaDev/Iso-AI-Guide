import { db, documentEmbeddingsTable, documentsTable, diagnosticsTable, chatMessagesTable, companiesTable, standardsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Generate embedding vector for a text using OpenRouter API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.slice(0, 8000), // Limit input size
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0]?.embedding ?? [];
  } catch (err) {
    logger.error({ err }, "Failed to generate embedding");
    return [];
  }
}

/**
 * Index a document into the vector store
 */
export async function indexDocument(docId: string, companyId: string): Promise<void> {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, docId));

    if (!doc || !doc.content) return;

    // Split content into chunks
    const chunks = chunkText(doc.content, 1000);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = await generateEmbedding(chunk);

      await db.insert(documentEmbeddingsTable).values({
        companyId,
        resourceType: "document",
        resourceId: docId,
        chunk,
        embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
        metadata: JSON.stringify({
          title: doc.title,
          type: doc.type,
          version: doc.version,
          status: doc.status,
          chunkIndex: i,
          totalChunks: chunks.length,
        }),
      });
    }

    logger.info({ docId, chunks: chunks.length }, "Document indexed");
  } catch (err) {
    logger.error({ err, docId }, "Failed to index document");
  }
}

/**
 * Index a diagnostic into the vector store
 */
export async function indexDiagnostic(diagnosticId: string, companyId: string): Promise<void> {
  try {
    const [diag] = await db
      .select()
      .from(diagnosticsTable)
      .where(eq(diagnosticsTable.id, diagnosticId));

    if (!diag) return;

    const sections = [
      { name: "contexto_organizacional", content: diag.organizationalContext },
      { name: "stakeholders", content: diag.stakeholders },
      { name: "mapa_processos", content: diag.processMap },
      { name: "riscos_oportunidades", content: diag.risksAndOpportunities },
      { name: "objetivos_qualidade", content: diag.qualityObjectives },
      { name: "recomendacoes", content: diag.recommendations },
    ];

    for (const section of sections) {
      if (!section.content) continue;

      const chunks = chunkText(section.content, 1000);
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        await db.insert(documentEmbeddingsTable).values({
          companyId,
          resourceType: "diagnostic",
          resourceId: diagnosticId,
          chunk,
          embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
          metadata: JSON.stringify({ section: section.name }),
        });
      }
    }

    logger.info({ diagnosticId }, "Diagnostic indexed");
  } catch (err) {
    logger.error({ err, diagnosticId }, "Failed to index diagnostic");
  }
}

/**
 * Search for relevant context using vector similarity
 * Falls back to text search when embeddings are not available
 */
export async function searchRelevantContext(
  companyId: string,
  query: string,
  limit: number = 5,
): Promise<string> {
  try {
    // Try vector search first
    const queryEmbedding = await generateEmbedding(query);
    
    if (queryEmbedding.length > 0) {
      const embeddingJson = JSON.stringify(queryEmbedding);
      
      // Use cosine similarity via pgvector
      const results = await db.execute(
        sql`
          SELECT chunk, metadata, resource_type, 1 - (embedding::vector <=> ${embeddingJson}::vector) AS similarity
          FROM document_embeddings
          WHERE company_id = ${companyId}::uuid
            AND embedding IS NOT NULL
          ORDER BY similarity DESC
          LIMIT ${limit}
        `
      );

      if (results.rows.length > 0) {
        return results.rows
          .map((r: any) => `[${r.resource_type}] (relevância: ${(r.similarity * 100).toFixed(0)}%)\n${r.chunk}`)
          .join("\n\n---\n\n");
      }
    }

    // Fallback: return most recent documents and diagnostics
    const recentDocs = await db
      .select({ title: documentsTable.title, content: documentsTable.content, type: documentsTable.type })
      .from(documentsTable)
      .where(eq(documentsTable.companyId, companyId))
      .orderBy(desc(documentsTable.createdAt))
      .limit(3);

    const recentDiag = await db
      .select()
      .from(diagnosticsTable)
      .where(eq(diagnosticsTable.companyId, companyId))
      .orderBy(desc(diagnosticsTable.createdAt))
      .limit(1);

    const parts: string[] = [];

    if (recentDiag[0]) {
      parts.push("=== DIAGNÓSTICO ATUAL ===");
      if (recentDiag[0].organizationalContext) parts.push(`Contexto: ${recentDiag[0].organizationalContext.slice(0, 300)}`);
      if (recentDiag[0].processMap) parts.push(`Processos: ${recentDiag[0].processMap.slice(0, 300)}`);
      if (recentDiag[0].recommendations) parts.push(`Recomendações: ${recentDiag[0].recommendations.slice(0, 300)}`);
    }

    if (recentDocs.length > 0) {
      parts.push("\n=== DOCUMENTOS RECENTES ===");
      for (const doc of recentDocs) {
        parts.push(`${doc.title} (${doc.type}): ${(doc.content || "").slice(0, 200)}`);
      }
    }

    return parts.join("\n\n");
  } catch (err) {
    logger.error({ err }, "Search failed, returning empty context");
    return "";
  }
}

function chunkText(text: string, maxChunkSize: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = "";
  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
