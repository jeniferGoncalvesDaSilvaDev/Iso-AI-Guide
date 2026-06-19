import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diagnosticsTable = pgTable("diagnostics", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  status: text("status").notNull().default("generating"),
  organizationalContext: text("organizational_context"),
  stakeholders: text("stakeholders"),
  processMap: text("process_map"),
  risksAndOpportunities: text("risks_and_opportunities"),
  qualityObjectives: text("quality_objectives"),
  recommendations: text("recommendations"),
  additionalInfo: text("additional_info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDiagnosticSchema = createInsertSchema(diagnosticsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDiagnostic = z.infer<typeof insertDiagnosticSchema>;
export type Diagnostic = typeof diagnosticsTable.$inferSelect;
