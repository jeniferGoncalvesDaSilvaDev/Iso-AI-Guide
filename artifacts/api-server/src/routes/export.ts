import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, documentsTable, documentMatrixTable } from "@workspace/db";
import { authenticateToken } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { DOCUMENT_MATRIX } from "../generators";

const router = Router();
router.use(authenticateToken);

// Export single document as HTML
router.get("/documents/:id/export/html", async (req, res): Promise<void> => {
  const { id } = req.params;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, id));

  if (!doc) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }

  const html = buildHtmlDocument(doc.title, doc.content || "", doc.version, doc.status);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${doc.title.replace(/[^a-zA-Z0-9]/g, "_")}_v${doc.version}.html"`);
  res.send(html);
});

// Export all documents as a single HTML bundle
router.get("/companies/:companyId/documents/export/bundle", async (req, res): Promise<void> => {
  const companyId = req.params.companyId;

  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.companyId, companyId))
    .orderBy(documentsTable.createdAt);

  if (docs.length === 0) {
    res.status(404).json({ error: "Nenhum documento encontrado" });
    return;
  }

  const sections = docs.map(doc => `
    <div class="document-page" style="page-break-after: always;">
      ${buildHtmlDocument(doc.title, doc.content || "", doc.version, doc.status)}
    </div>
  `).join("\n");

  const bundleHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>SGQ - Pacote Completo de Documentos</title>
  <style>
    @page { margin: 2.5cm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; }
    .document-page { padding: 2.5cm; }
    h1 { font-size: 22pt; margin-bottom: 0.5cm; }
    h2 { font-size: 16pt; margin-top: 0.8cm; margin-bottom: 0.3cm; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 0.2cm; }
    h3 { font-size: 13pt; margin-top: 0.5cm; margin-bottom: 0.2cm; color: #444; }
    p { margin-bottom: 0.3cm; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; }
    th, td { border: 1px solid #999; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    .header { text-align: center; margin-bottom: 1cm; padding-bottom: 0.5cm; border-bottom: 2px solid #333; }
    .footer { margin-top: 1cm; padding-top: 0.3cm; border-top: 1px solid #ccc; font-size: 9pt; color: #999; text-align: center; }
  </style>
</head>
<body>
  ${sections}
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="SGQ_Pacote_Completo.html"`);
  res.send(bundleHtml);

  await logAudit(req, "documents.export.bundle", "company", companyId);
});

// Export document matrix as HTML table
router.get("/companies/:companyId/document-matrix/export", async (req, res): Promise<void> => {
  const companyId = req.params.companyId;

  const matrix = await db
    .select()
    .from(documentMatrixTable)
    .where(eq(documentMatrixTable.companyId, companyId))
    .orderBy(documentMatrixTable.order);

  const rows = matrix.map(item => `
    <tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.section}</td>
      <td>${item.type}</td>
      <td>${item.revision}</td>
      <td>${item.status}</td>
      <td>${item.documentId ? "✅" : "❌"}</td>
    </tr>
  `).join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Matriz Documental - SGQ</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2cm; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 1cm; }
    th { background: #2563eb; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
  </style>
</head>
<body>
  <h1>Matriz Documental do SGQ</h1>
  <p>Gerado em: ${new Date().toLocaleDateString("pt-BR")}</p>
  <table>
    <thead><tr>
      <th>Código</th><th>Nome</th><th>Seção</th><th>Tipo</th><th>Revisão</th><th>Status</th><th>Gerado</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Matriz_Documental_SGQ.html"`);
  res.send(html);
});

function buildHtmlDocument(title: string, content: string, version: string, status: string): string {
  const bodyContent = content
    .split("\n")
    .map(line => {
      const t = line.trim();
      if (!t) return "<p>&nbsp;</p>";
      if (t.startsWith("# ")) return `<h1>${t.slice(2)}</h1>`;
      if (t.startsWith("## ")) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith("### ")) return `<h3>${t.slice(4)}</h3>`;
      if (t.startsWith("- ") || t.startsWith("* ")) return `<li>${t.slice(2)}</li>`;
      if (t.startsWith("|")) return `<p>${t}</p>`;
      if (t.startsWith("=")) return `<hr/>`;
      return `<p>${t}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { margin: 2.5cm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; padding: 2.5cm; }
    h1 { font-size: 22pt; margin-bottom: 0.5cm; color: #000; }
    h2 { font-size: 16pt; margin-top: 0.8cm; margin-bottom: 0.3cm; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 0.2cm; }
    h3 { font-size: 13pt; margin-top: 0.5cm; margin-bottom: 0.2cm; color: #444; }
    p { margin-bottom: 0.3cm; text-align: justify; }
    li { margin-left: 1cm; margin-bottom: 0.2cm; }
    table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; }
    th, td { border: 1px solid #999; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    hr { margin: 0.5cm 0; border: none; border-top: 1px solid #ccc; }
    .header { text-align: center; margin-bottom: 1cm; padding-bottom: 0.5cm; border-bottom: 2px solid #333; }
    .header h1 { margin-bottom: 0.2cm; }
    .meta { font-size: 10pt; color: #666; margin-bottom: 0.5cm; }
    .footer { margin-top: 1cm; padding-top: 0.3cm; border-top: 1px solid #ccc; font-size: 9pt; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">
      <p>Versão: ${version} | Status: ${status}</p>
    </div>
  </div>
  <div class="content">${bodyContent}</div>
  <div class="footer">
    <p>Documento gerado pelo Iso AI Guide - Plataforma de Gestão ISO com IA</p>
  </div>
</body>
</html>`;
}

export default router;
