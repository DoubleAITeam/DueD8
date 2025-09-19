import { BrowserWindow, dialog, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

function buildHtmlDocument(content: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DueD8 Export</title>
    <style>
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 48px;
        color: #0f172a;
        line-height: 1.6;
        max-width: 720px;
        margin: 0 auto;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 16px;
      }
      p {
        margin: 0 0 16px 0;
      }
      .segment {
        margin-bottom: 24px;
      }
      pre {
        white-space: pre-wrap;
        font-family: inherit;
      }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

export async function exportPdf(options: {
  courseCode: string;
  assignmentSlug: string;
  htmlBody: string;
}) {
  const { courseCode, assignmentSlug, htmlBody } = options;
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  const fullHtml = buildHtmlDocument(htmlBody);
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
  const pdfBuffer = await window.webContents.printToPDF({ printBackground: true, landscape: false });
  window.destroy();

  if (!pdfBuffer.length) {
    throw new Error('Generated PDF was empty.');
  }

  const defaultName = `${courseCode}_${assignmentSlug}_${formatDate(new Date())}.pdf`;
  const documentsPath = app.getPath('documents');
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: path.join(documentsPath, defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) {
    throw new Error('cancelled');
  }

  await fs.writeFile(filePath, pdfBuffer);
  return { filePath };
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
