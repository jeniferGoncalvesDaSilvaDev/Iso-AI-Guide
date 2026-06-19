import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationJobsTable = pgTable("generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  matrixId: uuid("matrix_id"), // specific document matrix item
  agent: text("agent").notNull(), // SGQAgent, AuditAgent, RiskAgent, etc.
  documentCode: text("document_code"), // SGQ-01, PQ-01, etc.
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  prompt: text("prompt"),
  result: text("result"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
