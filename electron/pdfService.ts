import { BrowserWindow } from 'electron';
import { mainError } from './logger';

export async function renderHtmlToPdfBuffer(html: string) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: false
    }
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const buffer = await window.webContents.printToPDF({ printBackground: true });
    if (!buffer.length) {
      throw new Error('Generated PDF was empty');
    }
    return buffer;
  } catch (error) {
    mainError('renderHtmlToPdfBuffer failed', (error as Error).message);
    throw error;
  } finally {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
}
