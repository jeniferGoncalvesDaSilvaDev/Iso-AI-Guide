import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Vector extension must be enabled: CREATE EXTENSION IF NOT EXISTS vector;
// pgvector column type for Drizzle - using text as fallback for compatibility
export const documentEmbeddingsTable = pgTable("document_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  resourceType: text("resource_type").notNull(), // document, diagnostic, standard, chat
  resourceId: uuid("resource_id").notNull(),
  chunk: text("chunk").notNull(),
  embedding: text("embedding"), // JSON array of floats - pgvector vector(1536)
  metadata: text("metadata"), // JSON string with additional info
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddingsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentEmbedding = z.infer<typeof insertDocumentEmbeddingSchema>;
export type DocumentEmbedding = typeof documentEmbeddingsTable.$inferSelect;
