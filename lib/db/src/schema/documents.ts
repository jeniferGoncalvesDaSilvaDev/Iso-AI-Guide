import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  standardId: uuid("standard_id").notNull(),
  standardCode: text("standard_code"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  version: text("version").notNull().default("00"),
  status: text("status").notNull().default("rascunho"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const documentRevisionsTable = pgTable("document_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull(),
  version: text("version").notNull(),
  content: text("content"),
  revisionReason: text("revision_reason"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentRevisionSchema = createInsertSchema(documentRevisionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
export type DocumentRevision = typeof documentRevisionsTable.$inferSelect;
