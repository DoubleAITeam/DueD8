import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { runDeliverablePipeline } from '../../electron/deliverables/pipeline';
import {
  __resetRegistryForTests,
  register as registerAdapter
} from '../../electron/deliverables/renderers/registry';
import type { RendererAdapter } from '../../electron/deliverables/renderers/adapter';
import staticHtmlAdapter from '../../electron/deliverables/renderers/staticHtml';
import copyPdfAdapter from '../../electron/deliverables/renderers/copyPdf';
import copyDocxAdapter from '../../electron/deliverables/renderers/copyDocx';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-fallback-'));
  return { tempDir: dir };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}));

describe('adapter registry fallback handling', () => {
  let htmlFile: string;

  beforeAll(async () => {
    htmlFile = path.join(tempDir, 'fallback.html');
    await fs.writeFile(htmlFile, '<html><body>fallback</body></html>');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    __resetRegistryForTests();
    registerAdapter(staticHtmlAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(copyDocxAdapter);
  });

  it('falls back to safe adapter after permanent failure', async () => {
    const failingAdapter: RendererAdapter = {
      id: 'stub-html-failure',
      handles: ['html'],
      async health() {
        return { ok: true };
      },
      async render({ artifact }) {
        return {
          id: artifact.id,
          success: false,
          adapterId: 'stub-html-failure',
          message: 'Stubbed failure',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'stub failure'
            }
          ]
        };
      }
    };

    __resetRegistryForTests();
    registerAdapter(staticHtmlAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(copyDocxAdapter);
    registerAdapter(failingAdapter);

    const artifacts: ArtifactInput[] = [
      { id: 'html-artifact', srcPath: htmlFile, type: 'html' }
    ];

    const result = await runDeliverablePipeline(artifacts);
    const job = result.run.results[0];

    expect(job.success).toBe(true);
    expect(job.adapterId).toBe('static-html');
    expect(job.adapterReason).toBe('Fallback adapter executed after primary failure.');
    expect(job.attempted).toEqual(['stub-html-failure', 'static-html']);
    expect(job.attempts).toBe(2);
    expect(job.message).toMatch(/Fallback .* succeeded/i);
    expect(job.outputPath).toBeTruthy();
  });
});
