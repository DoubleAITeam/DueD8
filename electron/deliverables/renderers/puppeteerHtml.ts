import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { getRenderFlags, getTimeoutMs } from '../config';
import type { DeliverableJobResult } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';
import { which } from '../utils/tools';

const moduleRequire = createRequire(typeof __filename === 'string' ? __filename : process.cwd());

const ADAPTER_ID = 'puppeteer-html';
const CHROME_ENV = 'CHROME_PATH';
const CHROME_CANDIDATE_CMDS = [
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
  'msedge',
  'microsoft-edge',
  'brave-browser'
];
const CHROME_CANDIDATE_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];

let cachedExecutable: { value: string | null; timestamp: number } | null = null;
const EXECUTABLE_CACHE_TTL = 60_000;

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  setRequestInterception(enabled: boolean): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForNetworkIdle?(options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T>;
  pdf(options?: Record<string, unknown>): Promise<Buffer>;
  close(): Promise<void>;
}

interface PuppeteerLike {
  launch(options: Record<string, unknown>): Promise<BrowserLike>;
}

async function loadPuppeteer(): Promise<PuppeteerLike | null> {
  try {
    const moduleName = 'puppeteer-core';
    try {
      const imported = await import(moduleName);
      if (imported && typeof imported === 'object' && 'launch' in imported) {
        return imported as unknown as PuppeteerLike;
      }
    } catch (dynamicError) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const required = moduleRequire(moduleName);
        if (required && typeof required === 'object' && 'launch' in required) {
          return required as PuppeteerLike;
        }
      } catch {
        throw dynamicError;
      }
    }
  } catch (error) {
    console.warn('[deliverables:puppeteer] Failed to load puppeteer-core', error);
  }
  return null;
}

async function resolveExecutable(): Promise<string | null> {
  const now = Date.now();
  if (cachedExecutable && now - cachedExecutable.timestamp < EXECUTABLE_CACHE_TTL) {
    return cachedExecutable.value;
  }

  const envPath = process.env[CHROME_ENV];
  if (envPath) {
    try {
      await fs.access(envPath);
      cachedExecutable = { value: envPath, timestamp: now };
      return envPath;
    } catch {
      // ignore and continue search
    }
  }

  for (const cmd of CHROME_CANDIDATE_CMDS) {
    const located = await which(cmd);
    if (located) {
      cachedExecutable = { value: located, timestamp: now };
      return located;
    }
  }

  for (const candidate of CHROME_CANDIDATE_PATHS) {
    try {
      await fs.access(candidate);
      cachedExecutable = { value: candidate, timestamp: now };
      return candidate;
    } catch {
      continue;
    }
  }

  cachedExecutable = { value: null, timestamp: now };
  return null;
}

async function ensureBrowserHealthy(): Promise<{ ok: boolean; message?: string }> {
  const flags = getRenderFlags();
  if (!flags.html_puppeteer) {
    return { ok: false, message: 'disabled by flag' };
  }

  const puppeteer = await loadPuppeteer();
  if (!puppeteer) {
    return { ok: false, message: 'puppeteer-core not available.' };
  }

  const executablePath = await resolveExecutable();
  if (!executablePath) {
    return { ok: false, message: 'No Chromium-based browser executable found.' };
  }

  try {
    const browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.goto('about:blank', { waitUntil: 'load', timeout: 5000 }).catch(() => undefined);
    await page.close();
    await browser.close();
    return { ok: true, message: `Chromium ready at ${executablePath}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to launch browser.';
    return { ok: false, message };
  }
}

async function sanitizePage(page: PageLike): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('script').forEach((script) => script.remove());
    document.querySelectorAll('[onclick],[onload],[onerror]').forEach((element) => {
      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        if (attr.name.toLowerCase().startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      }
    });
  });
}

export const puppeteerHtmlAdapter: RendererAdapter = {
  id: ADAPTER_ID,
  handles: ['html'],
  async health(): Promise<AdapterHealth> {
    return ensureBrowserHealthy();
  },
  async render({ artifact, outDir, signal, dryRun }): Promise<DeliverableJobResult> {
    const baseResult: DeliverableJobResult = {
      id: artifact.id,
      success: false,
      adapterId: ADAPTER_ID,
      dryRun: Boolean(dryRun)
    };

    if (signal.aborted) {
      return {
        ...baseResult,
        message: 'Render aborted before starting.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'Render aborted via abort signal.'
          }
        ]
      };
    }

    const flags = getRenderFlags();
    if (!flags.html_puppeteer) {
      return {
        ...baseResult,
        message: 'Adapter disabled by feature flag.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'Feature flag disabled.'
          }
        ]
      };
    }

    if (dryRun) {
      return {
        ...baseResult,
        success: true,
        message: 'Dry run complete — no files written.'
      };
    }

    const puppeteer = await loadPuppeteer();
    if (!puppeteer) {
      return {
        ...baseResult,
        message: 'puppeteer-core not available.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'puppeteer-core not installed.'
          }
        ]
      };
    }

    const executablePath = await resolveExecutable();
    if (!executablePath) {
      return {
        ...baseResult,
        message: 'No Chromium-based browser executable found.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'Chromium executable missing.'
          }
        ]
      };
    }

    try {
      await fs.mkdir(outDir, { recursive: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to prepare output directory.';
      return {
        ...baseResult,
        message,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ]
      };
    }

    const destination = path.join(outDir, `${artifact.id}.pdf`);
    const workingPath = `${destination}.working`;

    let browser: BrowserLike | null = null;
    let page: PageLike | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        timeout: getTimeoutMs()
      });
      const activePage = await browser.newPage();
      page = activePage;
      await activePage.setRequestInterception(true);
      activePage.on('request', (request: any) => {
        const url = request.url();
        if (url.startsWith('file://')) {
          request.continue();
        } else {
          request.abort();
        }
      });

      const fileUrl = pathToFileURL(artifact.srcPath).toString();
      await activePage
        .goto(fileUrl, { waitUntil: 'networkidle0', timeout: getTimeoutMs() })
        .catch(async () => {
          await activePage.goto(fileUrl, { waitUntil: 'load', timeout: getTimeoutMs() });
        });
      await sanitizePage(activePage);

      const pdfBuffer = await activePage.pdf({
        printBackground: true,
        preferCSSPageSize: true
      });

      if (signal.aborted) {
        await activePage.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
        return {
          ...baseResult,
          message: 'Render aborted before completion.',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'Render aborted via abort signal.'
            }
          ]
        };
      }

      await activePage.close();
      await browser.close();

      await fs.writeFile(workingPath, pdfBuffer);
      await fs.rename(workingPath, destination);

      return {
        ...baseResult,
        success: true,
        outputPath: destination,
        message: 'HTML rendered to PDF via Puppeteer.'
      };
    } catch (error) {
      await fs.rm(workingPath, { force: true }).catch(() => undefined);
      await page?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
      const message = error instanceof Error ? error.message : 'HTML render failed.';
      return {
        ...baseResult,
        message,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ]
      };
    }
  }
};

export default puppeteerHtmlAdapter;
