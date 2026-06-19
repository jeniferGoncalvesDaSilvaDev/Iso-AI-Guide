import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";
import { logger } from "./logger";

export async function logAudit(
  req: Request,
  action: string,
  resourceType?: string,
  resourceId?: string,
): Promise<void> {
  try {
    const user = (req as { user?: { userId: string; email: string; role: string; companyId: string | null } }).user;
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      null;

    await db.insert(auditLogsTable).values({
      userId: user?.userId ?? null,
      userName: user?.email ?? null,
      companyId: user?.companyId ?? null,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ? resourceId : null,
      ipAddress: ip,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}
