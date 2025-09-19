import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      offscreen: true,
      contextIsolation: true
    }
  });

  try {
    const content = html.trim().length ? html : '<html><body></body></html>';
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
    const pdf = await win.webContents.printToPDF({ printBackground: true, marginsType: 0 });
    return Buffer.from(pdf);
  } finally {
    win.destroy();
  }
}

export async function savePdfToPath(buffer: Buffer, filePath: string) {
  await fs.writeFile(filePath, buffer);
}
