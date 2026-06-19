import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.use(authenticateToken);

router.get("/audit-logs", async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  const { companyId, limit, offset } = params.success
    ? params.data
    : { companyId: undefined, limit: undefined, offset: undefined };

  let query = db.select().from(auditLogsTable).$dynamic();
  if (companyId) query = query.where(eq(auditLogsTable.companyId, companyId));

  const logs = await query
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(logs);
});

export default router;
