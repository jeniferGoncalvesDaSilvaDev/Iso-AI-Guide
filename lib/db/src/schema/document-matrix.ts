import { pgTable, text, timestamp, integer, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentMatrixTable = pgTable("document_matrix", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  section: text("section").notNull(),
  type: text("type").notNull(), // SGQ, PQ, FQ, RQ, RT, RC, OP
  status: text("status").notNull().default("pendente"), // pendente, gerando, concluido, erro
  revision: text("revision").notNull().default("00"),
  documentId: uuid("document_id"), // reference to documents table when generated
  standardId: uuid("standard_id"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDocumentMatrixSchema = createInsertSchema(documentMatrixTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentMatrix = z.infer<typeof insertDocumentMatrixSchema>;
export type DocumentMatrix = typeof documentMatrixTable.$inferSelect;
