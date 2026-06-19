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

  const systemPrompt = `Você é o assistente IA especializado em normas ISO da plataforma ISO Gestão IA. Você ajuda empresas a implementar sistemas de gestão de qualidade de forma prática e acessível.

${company ? `Empresa: ${company.name} | Setor: ${company.sector} | Porte: ${company.size}` : ""}
${recentDiag[0] ? `Diagnóstico: ${recentDiag[0].qualityObjectives ?? "Em andamento"}` : ""}
${recentDocs.length > 0 ? `Documentos: ${recentDocs.map((d) => `${d.title} (${d.status})`).join(", ")}` : ""}

Responda sempre em português do Brasil. Use linguagem simples e acessível. Seja prático e objetivo.
Quando o usuário tiver dúvidas sobre ISO, explique de forma clara, evitando jargões técnicos.`;

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
