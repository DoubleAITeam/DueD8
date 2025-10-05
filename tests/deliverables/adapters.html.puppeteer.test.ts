import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'puppeteer-adapter-'));
  return { tempDir: dir };
});

type SetupOptions = {
  puppeteerAvailable: boolean;
};

async function loadAdapter(options: SetupOptions) {
  vi.resetModules();
  vi.doMock('../../electron/deliverables/utils/tools', () => ({
    which: vi.fn(),
    spawnWithLimits: vi.fn()
  }));
  if (options.puppeteerAvailable) {
    const launch = vi.fn(async () => {
      let requestHandler: ((request: { url(): string; continue(): void; abort(): void }) => void) | null = null;
      const page = {
        async setRequestInterception() {
          return;
        },
        on(event: string, handler: typeof requestHandler) {
          if (event === 'request') {
            requestHandler = handler;
          }
        },
        async goto() {
          if (requestHandler) {
            requestHandler({
              url: () => 'file://test',
              continue: () => undefined,
              abort: () => undefined
            });
          }
        },
        async pdf() {
          return Buffer.from('%PDF-1.4');
        },
        async close() {
          return;
        },
        async evaluate(fn: () => void) {
          fn();
        }
      };
      return {
        async newPage() {
          return page;
        },
        async close() {
          return;
        }
      };
    });
    vi.doMock('puppeteer-core', () => ({
      launch
    }));
  } else {
    vi.doMock('puppeteer-core', () => {
      throw new Error('module not found');
    });
  }

  const adapterModule = await import('../../electron/deliverables/renderers/puppeteerHtml');
  const tools = await import('../../electron/deliverables/utils/tools');
  return {
    adapter: adapterModule.default,
    tools: {
      which: vi.mocked(tools.which)
    }
  } as const;
}

describe('puppeteer HTML adapter', () => {
  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.resetModules();
    delete process.env.DELIV_HTML_PUPPETEER;
    delete process.env.CHROME_PATH;
    resetDeliverablesConfigCache();
  });

  it('reports missing puppeteer module when unavailable', async () => {
    const { adapter } = await loadAdapter({ puppeteerAvailable: false });
    process.env.DELIV_HTML_PUPPETEER = '1';
    resetDeliverablesConfigCache();
    const health = await adapter.health();
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/puppeteer-core not available/i);
  });

  it('renders HTML to PDF when puppeteer is available', async () => {
    const { adapter, tools } = await loadAdapter({ puppeteerAvailable: true });
    process.env.DELIV_HTML_PUPPETEER = '1';
    resetDeliverablesConfigCache();
    tools.which.mockResolvedValue('/usr/bin/chromium');

    const artifactPath = path.join(tempDir, 'page.html');
    await fs.writeFile(artifactPath, '<html><body>puppeteer test</body></html>');
    const outDir = path.join(tempDir, 'rendered');

    const health = await adapter.health();
    expect(health.ok).toBe(true);

    const result = await adapter.render({
      artifact: { id: 'html-artifact', srcPath: artifactPath, type: 'html' },
      outDir,
      signal: new AbortController().signal,
      dryRun: false
    });

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(path.join(outDir, 'html-artifact.pdf'));
    const stat = await fs.stat(result.outputPath!);
    expect(stat.isFile()).toBe(true);
  });
});
