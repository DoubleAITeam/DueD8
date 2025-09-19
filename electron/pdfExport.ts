import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';

function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 48px;
        color: #0f172a;
        background: #ffffff;
      }
      h1, h2, h3 {
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 16px;
      }
      .solution-document {
        max-width: 780px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .solution-document header {
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 16px;
      }
      .solution-document header h1 {
        margin: 0 0 12px 0;
        font-size: 28px;
      }
      .solution-document header .metadata {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        color: #475569;
        font-size: 14px;
      }
      .solution-document section {
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 20px 24px;
        background: #f8fafc;
      }
      .solution-document section h2 {
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 18px;
      }
      .solution-document section p {
        margin: 0 0 12px 0;
        line-height: 1.6;
      }
      .solution-document section ul,
      .solution-document section ol {
        margin: 0 0 0 20px;
        padding: 0;
        line-height: 1.6;
      }
      .solution-document section li + li {
        margin-top: 6px;
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

export async function exportSolutionPdf(options: {
  browserWindow: BrowserWindow;
  html: string;
  title: string;
  defaultFileName: string;
}): Promise<{ cancelled: boolean; filePath?: string }> {
  const { browserWindow, html, title, defaultFileName } = options;
  const documentsDir = app.getPath('documents');
  const defaultPath = path.join(documentsDir, `${defaultFileName}.pdf`);
  const { filePath, canceled } = await dialog.showSaveDialog(browserWindow, {
    title: 'Save completed assignment as PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) {
    return { cancelled: true };
  }

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: false }
  });

  try {
    const wrapped = wrapHtmlDocument(title, html);
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(wrapped)}`);
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: 'A4'
    });
    await fs.writeFile(filePath, pdfBuffer);
    return { cancelled: false, filePath };
  } finally {
    if (!pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
  }
}
