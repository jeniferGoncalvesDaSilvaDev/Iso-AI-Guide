import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const standardsTable = pgTable("standards", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  benefits: text("benefits").array().notNull().default([]),
  applicableSectors: text("applicable_sectors").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companyStandardsTable = pgTable("company_standards", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  standardId: uuid("standard_id").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStandardSchema = createInsertSchema(standardsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertStandard = z.infer<typeof insertStandardSchema>;
export type Standard = typeof standardsTable.$inferSelect;
export type CompanyStandard = typeof companyStandardsTable.$inferSelect;
