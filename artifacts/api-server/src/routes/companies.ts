import { Router } from "express";
import { eq, and, not, inArray } from "drizzle-orm";
import { db, companiesTable, diagnosticsTable } from "@workspace/db";
import {
  CreateCompanyBody,
  UpdateCompanyBody,
  GetCompanyParams,
  UpdateCompanyParams,
  DeleteCompanyParams,
} from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.use(authenticateToken);

router.get("/companies", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.ownerId, userId));
  res.json(companies);
});

router.post("/companies", async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as {
    name: string;
    sector: string;
    size: string;
    activity?: string;
    description?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
  };

  const [company] = await db
    .insert(companiesTable)
    .values({ ...data, ownerId: req.user!.userId })
    .returning();

  await logAudit(req, "company.create", "company", company?.id);
  res.status(201).json(company);
});

router.get("/companies/:id", async (req, res): Promise<void> => {
  const params = GetCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, params.data.id),
        eq(companiesTable.ownerId, req.user!.userId),
      ),
    );

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  res.json(company);
});

router.patch("/companies/:id", async (req, res): Promise<void> => {
  const params = UpdateCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [company] = await db
    .update(companiesTable)
    .set(parsed.data)
    .where(
      and(
        eq(companiesTable.id, params.data.id),
        eq(companiesTable.ownerId, req.user!.userId),
      ),
    )
    .returning();

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  // Mark existing diagnostics as outdated since company data changed
  await db
    .update(diagnosticsTable)
    .set({ status: "outdated" })
    .where(
      and(
        eq(diagnosticsTable.companyId, params.data.id),
        not(inArray(diagnosticsTable.status, ["generating", "outdated"]))
      )
    );

  await logAudit(req, "company.update", "company", company.id);
  res.json(company);
});

router.delete("/companies/:id", async (req, res): Promise<void> => {
  const params = DeleteCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [company] = await db
    .delete(companiesTable)
    .where(
      and(
        eq(companiesTable.id, params.data.id),
        eq(companiesTable.ownerId, req.user!.userId),
      ),
    )
    .returning();

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  await logAudit(req, "company.delete", "company", params.data.id);
  res.sendStatus(204);
});

export default router;
