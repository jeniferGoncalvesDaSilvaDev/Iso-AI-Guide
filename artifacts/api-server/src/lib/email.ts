import nodemailer from "nodemailer";
import { logger } from "./logger";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "2525", 10);
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_USERNAME || "";
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || "noreply@iso-guide.com";
const APP_NAME = "Iso AI Guide";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    logger.info("SMTP configured");
  } else {
    logger.warn("SMTP not configured — emails will be logged to console");
  }

  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();

  if (t) {
    try {
      await t.sendMail({
        // Use FROM_EMAIL directly if it contains angle brackets (already has name), otherwise format
    from: FROM_EMAIL.includes("<") ? FROM_EMAIL : `"${APP_NAME}" <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      });
      logger.info({ to, subject }, "Email sent");
    } catch (err) {
      logger.error({ err, to }, "Failed to send email");
    }
  } else {
    // Dev fallback: log to console
    logger.info({ to, subject }, "--- EMAIL (console) ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html}`);
    console.log("--- END EMAIL ---");
  }
}

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
  <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px; text-align: center;">
    <h1 style="margin: 0;">${APP_NAME}</h1>
  </div>
  <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
    <h2>Conta criada com sucesso! 🎉</h2>
    <p>Olá <strong>${userName}</strong>,</p>
    <p>Sua conta foi criada com sucesso no <strong>${APP_NAME}</strong>.</p>
    <p>Agora você pode:</p>
    <ul>
      <li>✅ Configurar os dados da sua empresa</li>
      <li>✅ Selecionar as normas ISO desejadas</li>
      <li>✅ Gerar diagnósticos com IA</li>
      <li>✅ Criar toda a documentação do SGQ</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.APP_URL || "https://iso-ai-guide.onrender.com"}/app/dashboard"
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Acessar minha conta
      </a>
    </div>
    <p style="color: #6b7280; font-size: 12px;">Se não foi você, ignore este email.</p>
  </div>
</body>
</html>`;

  await sendEmail(to, `Conta criada com sucesso — ${APP_NAME}`, html);
}

export async function sendResetPasswordEmail(to: string, userName: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.APP_URL || "https://iso-ai-guide.onrender.com"}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
  <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px; text-align: center;">
    <h1 style="margin: 0;">${APP_NAME}</h1>
  </div>
  <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
    <h2>Redefinir sua senha</h2>
    <p>Olá <strong>${userName}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}"
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Redefinir sua senha
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Este link expira em 1 hora.</p>
    <p style="color: #6b7280; font-size: 12px;">Se não foi você, ignore este email.</p>
  </div>
</body>
</html>`;

  await sendEmail(to, `Redefinir sua senha — ${APP_NAME}`, html);
}
