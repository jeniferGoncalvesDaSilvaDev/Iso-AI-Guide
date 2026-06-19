import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  LoginBody,
  RefreshTokenBody,
} from "@workspace/api-zod";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, companyName } = parsed.data as {
    name: string;
    email: string;
    password: string;
    companyName?: string;
  };

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let companyId: string | null = null;

  if (companyName) {
    const [company] = await db
      .insert(companiesTable)
      .values({
        name: companyName,
        sector: "Geral",
        size: "pequena",
        ownerId: "00000000-0000-0000-0000-000000000000",
      })
      .returning();
    companyId = company?.id ?? null;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash,
      role: "admin",
      companyId,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Erro ao criar usuário" });
    return;
  }

  if (companyId) {
    await db
      .update(companiesTable)
      .set({ ownerId: user.id })
      .where(eq(companiesTable.id, companyId));
    await db
      .update(usersTable)
      .set({ companyId })
      .where(eq(usersTable.id, user.id));
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId ?? null,
  };
  const accessToken = signAccessToken(jwtPayload);
  const refreshToken = signRefreshToken(jwtPayload);

  await db
    .update(usersTable)
    .set({ refreshToken })
    .where(eq(usersTable.id, user.id));

  await logAudit(req, "user.register", "user", user.id);

  // Send welcome email (non-blocking)
  import("../lib/email").then(m => m.sendWelcomeEmail(user.email, user.name)).catch(() => {});

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId ?? null,
  };
  const accessToken = signAccessToken(jwtPayload);
  const refreshToken = signRefreshToken(jwtPayload);

  await db
    .update(usersTable)
    .set({ refreshToken })
    .where(eq(usersTable.id, user.id));

  await logAudit(req, "user.login", "user", user.id);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { refreshToken } = parsed.data;

  try {
    const payload = verifyRefreshToken(refreshToken);
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ error: "Token de atualização inválido" });
      return;
    }

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    };
    const newAccessToken = signAccessToken(jwtPayload);
    const newRefreshToken = signRefreshToken(jwtPayload);

    await db
      .update(usersTable)
      .set({ refreshToken: newRefreshToken })
      .where(eq(usersTable.id, user.id));

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Token de atualização inválido" });
  }
});

router.post("/auth/logout", authenticateToken, async (req, res): Promise<void> => {
  if (req.user) {
    await db
      .update(usersTable)
      .set({ refreshToken: null })
      .where(eq(usersTable.id, req.user.userId));
    await logAudit(req, "user.logout", "user", req.user.userId);
  }
  res.sendStatus(204);
});

router.get("/auth/me", authenticateToken, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    createdAt: user.createdAt,
  });
});

// ─── Password Reset ─────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email é obrigatório" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  // Always return success to avoid leaking user info
  if (!user) {
    res.json({ message: "Se o email existir, você receberá um link para redefinir sua senha." });
    return;
  }

  // Generate reset token (valid for 1 hour)
  const crypto = await import("node:crypto");
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 3600000); // 1 hour

  await db
    .update(usersTable)
    .set({ resetToken, resetExpires })
    .where(eq(usersTable.id, user.id));

  // Send reset email
  import("../lib/email").then(m => m.sendResetPasswordEmail(user.email, user.name, resetToken)).catch(() => {});

  res.json({ message: "Se o email existir, você receberá um link para redefinir sua senha." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    res.status(400).json({ error: "Token e nova senha são obrigatórios" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.resetToken, token))
    .limit(1);

  if (!user || !user.resetExpires) {
    res.status(400).json({ error: "Token inválido ou expirado" });
    return;
  }

  if (new Date() > new Date(user.resetExpires)) {
    res.status(400).json({ error: "Token expirado. Solicite um novo." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, resetToken: null, resetExpires: null })
    .where(eq(usersTable.id, user.id));

  await logAudit(req, "user.reset-password", "user", user.id);

  res.json({ message: "Senha redefinida com sucesso!" });
});

export default router;
