import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, chatMessagesTable, companiesTable, documentsTable, diagnosticsTable } from "@workspace/db";
import { SendChatMessageBody, GetChatHistoryQueryParams } from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { chat } from "../lib/openrouter";

const router = Router();

router.use(authenticateToken);

router.post("/chat/messages", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { content, companyId, conversationId } = parsed.data as {
    content: string;
    companyId: string;
    conversationId?: string;
  };

  const convId = conversationId ?? crypto.randomUUID();

  await db.insert(chatMessagesTable).values({
    companyId,
    userId: req.user!.userId,
    conversationId: convId,
    role: "user",
    content,
  });

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  const recentDocs = await db
    .select({ title: documentsTable.title, type: documentsTable.type, status: documentsTable.status })
    .from(documentsTable)
    .where(eq(documentsTable.companyId, companyId))
    .limit(5);

  const recentDiag = await db
    .select()
    .from(diagnosticsTable)
    .where(eq(diagnosticsTable.companyId, companyId))
    .orderBy(desc(diagnosticsTable.createdAt))
    .limit(1);

  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, convId))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(10);

  // Buscar contexto relevante via RAG
  let ragContext = "";
  try {
    const { searchRelevantContext } = await import("../generators/rag");
    ragContext = await searchRelevantContext(companyId, content, 5);
  } catch (e) {
    // RAG fallback - continue without
  }

  const systemPrompt = `Você é o CONSULTOR ISO ESPECIALISTA da plataforma ISO Gestão IA. Você atua como um consultor sênior com 20+ anos de experiência em implementação e auditoria de sistemas de gestão da qualidade.

${company ? `EMPRESA: ${company.name} | Setor: ${company.sector} | Porte: ${company.size}` : ""}
${recentDiag[0] ? `DIAGNÓSTICO ATUAL: ${recentDiag[0].qualityObjectives ?? "Em andamento"}` : ""}
${recentDocs.length > 0 ? `DOCUMENTOS GERADOS: ${recentDocs.map((d) => `${d.title} (${d.status})`).join(", ")}` : ""}

${ragContext ? `
**CONTEXTO RECUPERADO (RAG):**
${ragContext}
` : ""}

DIRETRIZES:
- Responda SEMPRE em português do Brasil
- Use linguagem técnica, clara e prática - como um consultor ISO de verdade
- Baseie suas respostas nos documentos, diagnóstico e contexto fornecidos acima
- Quando o usuário perguntar sobre requisitos ISO, cite os itens específicos da norma
- Sugira ações práticas e aplicáveis à realidade da empresa
- Se não souber algo, seja honesto e sugira consultar a documentação disponível na plataforma
- Profundidade compatível com consultoria profissional (R$ 15k-30k)`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    { role: "user" as const, content },
  ];

  const aiResponse = await chat(messages, { maxTokens: 2048 });

  const [saved] = await db
    .insert(chatMessagesTable)
    .values({
      companyId,
      userId: req.user!.userId,
      conversationId: convId,
      role: "assistant",
      content: aiResponse,
    })
    .returning();

  res.json({
    id: saved!.id,
    role: "assistant",
    content: aiResponse,
    companyId,
    conversationId: convId,
    createdAt: saved!.createdAt,
  });
});

router.get("/chat/history", async (req, res): Promise<void> => {
  const params = GetChatHistoryQueryParams.safeParse(req.query);
  const { companyId, limit } = params.success ? params.data : { companyId: undefined, limit: undefined };

  let query = db.select().from(chatMessagesTable).$dynamic();
  if (companyId) query = query.where(eq(chatMessagesTable.companyId, companyId));

  const messages = await query
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit ?? 50);

  res.json(messages.reverse());
});

export default router;
