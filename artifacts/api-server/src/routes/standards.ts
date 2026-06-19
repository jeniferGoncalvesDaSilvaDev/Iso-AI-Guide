import { Router } from "express";
import { eq, and, not, inArray } from "drizzle-orm";
import { db, standardsTable, companyStandardsTable, diagnosticsTable } from "@workspace/db";
import { SelectCompanyStandardsBody } from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.use(authenticateToken);

router.get("/standards", async (_req, res): Promise<void> => {
  const standards = await db.select().from(standardsTable);

  res.json(
    standards.map((s) => ({
      ...s,
      benefits: s.benefits ?? [],
      applicableSectors: s.applicableSectors ?? [],
    })),
  );
});

router.get("/companies/:id/standards", async (req, res): Promise<void> => {
  const companyId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const links = await db
    .select()
    .from(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId!));

  if (links.length === 0) {
    res.json([]);
    return;
  }

  const standardIds = links.map((l) => l.standardId);
  const standards = await db
    .select()
    .from(standardsTable)
    .where(inArray(standardsTable.id, standardIds));

  res.json(
    standards.map((s) => ({
      ...s,
      benefits: s.benefits ?? [],
      applicableSectors: s.applicableSectors ?? [],
    })),
  );
});

router.post("/companies/:id/standards", async (req, res): Promise<void> => {
  const companyId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const parsed = SelectCompanyStandardsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { standardIds } = parsed.data;

  await db
    .delete(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId!));

  if (standardIds.length > 0) {
    await db.insert(companyStandardsTable).values(
      standardIds.map((sid: string) => ({
        companyId: companyId!,
        standardId: sid,
      })),
    );
  }

  // Mark existing diagnostics as outdated since standards selection changed
  await db
    .update(diagnosticsTable)
    .set({ status: "outdated" })
    .where(
      and(
        eq(diagnosticsTable.companyId, companyId!),
        not(inArray(diagnosticsTable.status, ["generating", "outdated"]))
      )
    );

  const links = await db
    .select()
    .from(companyStandardsTable)
    .where(eq(companyStandardsTable.companyId, companyId!));

  if (links.length === 0) {
    await logAudit(req, "standards.select", "company", companyId);
    res.json([]);
    return;
  }

  const standards = await db
    .select()
    .from(standardsTable)
    .where(
      inArray(
        standardsTable.id,
        links.map((l) => l.standardId),
      ),
    );

  res.json(
    standards.map((s) => ({
      ...s,
      benefits: s.benefits ?? [],
      applicableSectors: s.applicableSectors ?? [],
    })),
  );
});

export default router;
