import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import type { ArtifactInput } from '../../electron/deliverables/types';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'qpdf-adapter-'));
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

describe('qpdf PDF adapter fallback', () => {
  beforeAll(async () => {
    await fs.writeFile(path.join(tempDir, 'input.pdf'), 'PDF data');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.resetModules();
    delete process.env.DELIV_PDF_QPDF;
    resetDeliverablesConfigCache();
    const registry = await import('../../electron/deliverables/renderers/registry');
    const staticHtml = (await import('../../electron/deliverables/renderers/staticHtml')).default;
    const copyPdf = (await import('../../electron/deliverables/renderers/copyPdf')).default;
    const copyDocx = (await import('../../electron/deliverables/renderers/copyDocx')).default;
    registry.__resetRegistryForTests();
    registry.register(staticHtml);
    registry.register(copyPdf);
    registry.register(copyDocx);
  });

  it('falls back to copy adapter when qpdf fails', async () => {
    vi.resetModules();
    vi.doMock('../../electron/deliverables/utils/tools', () => ({
      which: vi.fn(),
      spawnWithLimits: vi.fn()
    }));

    process.env.DELIV_PDF_QPDF = '1';
    resetDeliverablesConfigCache();

    const tools = await import('../../electron/deliverables/utils/tools');
    const whichMock = vi.mocked(tools.which);
    const spawnMock = vi.mocked(tools.spawnWithLimits);
    whichMock.mockResolvedValue('/usr/bin/qpdf');
    spawnMock.mockImplementation(async (_cmd, args) => {
      if (args?.includes('--version')) {
        return { code: 0, stdout: 'qpdf 11.0', stderr: '' };
      }
      return { code: 1, stdout: '', stderr: 'failed to linearize' };
    });

    const registry = await import('../../electron/deliverables/renderers/registry');
    const staticHtml = (await import('../../electron/deliverables/renderers/staticHtml')).default;
    const copyPdf = (await import('../../electron/deliverables/renderers/copyPdf')).default;
    const copyDocx = (await import('../../electron/deliverables/renderers/copyDocx')).default;
    const qpdfAdapter = (await import('../../electron/deliverables/renderers/qpdfPdf')).default;
    registry.__resetRegistryForTests();
    registry.register(staticHtml);
    registry.register(copyPdf);
    registry.register(copyDocx);
    registry.register(qpdfAdapter);

    const { runDeliverablePipeline } = await import('../../electron/deliverables/pipeline');
    const artifacts: ArtifactInput[] = [
      { id: 'pdf-artifact', srcPath: path.join(tempDir, 'input.pdf'), type: 'pdf' }
    ];

    const result = await runDeliverablePipeline(artifacts);
    const job = result.run.results[0];

    expect(job.success).toBe(true);
    expect(job.adapterId).toBe('copy-pdf');
    expect(job.attempted).toEqual(['qpdf-pdf', 'copy-pdf']);
    expect(job.attempts).toBe(2);
    expect(job.message).toMatch(/Fallback .* succeeded/i);
  });
});
