import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'libreoffice-adapter-'));
  return { tempDir: dir };
});

async function loadAdapter() {
  vi.resetModules();
  vi.doMock('../../electron/deliverables/utils/tools', () => ({
    which: vi.fn(),
    spawnWithLimits: vi.fn()
  }));
  const adapterModule = await import('../../electron/deliverables/renderers/libreofficeDocx');
  const tools = await import('../../electron/deliverables/utils/tools');
  return {
    adapter: adapterModule.default,
    tools: {
      which: vi.mocked(tools.which),
      spawnWithLimits: vi.mocked(tools.spawnWithLimits)
    }
  } as const;
}

describe('libreoffice DOCX adapter', () => {
  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.resetModules();
    delete process.env.DELIV_DOCX_LIBREOFFICE;
    resetDeliverablesConfigCache();
  });

  it('converts DOCX files to PDF with mocked LibreOffice', async () => {
    const { adapter, tools } = await loadAdapter();
    process.env.DELIV_DOCX_LIBREOFFICE = '1';
    resetDeliverablesConfigCache();

    tools.which.mockResolvedValue('/usr/bin/soffice');
    tools.spawnWithLimits.mockImplementation(async (_cmd, args) => {
      if (args?.includes('--version')) {
        return { code: 0, stdout: 'LibreOffice 7.5', stderr: '' };
      }
      const outDirIndex = (args ?? []).indexOf('--outdir');
      if (outDirIndex >= 0) {
        const outDir = args?.[outDirIndex + 1];
        if (!outDir) {
          throw new Error('Missing output directory argument');
        }
        const produced = path.join(outDir, 'source.pdf');
        await fs.writeFile(produced, 'PDF data');
        return { code: 0, stdout: '', stderr: '' };
      }
      throw new Error('Unexpected spawn invocation');
    });

    const artifactPath = path.join(tempDir, 'source.docx');
    await fs.writeFile(artifactPath, 'DOCX content');
    const outDir = path.join(tempDir, 'outputs');

    const health = await adapter.health();
    expect(health.ok).toBe(true);

    const result = await adapter.render({
      artifact: { id: 'docx-artifact', srcPath: artifactPath, type: 'docx' },
      outDir,
      signal: new AbortController().signal,
      dryRun: false
    });

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(path.join(outDir, 'docx-artifact.pdf'));
    const outputStat = await fs.stat(result.outputPath!);
    expect(outputStat.isFile()).toBe(true);
  });

  it('returns structured errors when LibreOffice times out', async () => {
    const { adapter, tools } = await loadAdapter();
    process.env.DELIV_DOCX_LIBREOFFICE = '1';
    resetDeliverablesConfigCache();

    tools.which.mockResolvedValue('/usr/bin/soffice');
    tools.spawnWithLimits.mockImplementation(async (_cmd, args) => {
      if (args?.includes('--version')) {
        return { code: 0, stdout: 'LibreOffice 7.5', stderr: '' };
      }
      const error = new Error('Timed out running LibreOffice');
      (error as NodeJS.ErrnoException).code = 'ETIME';
      throw error;
    });

    const artifactPath = path.join(tempDir, 'timeout.docx');
    await fs.writeFile(artifactPath, 'DOCX content');
    const outDir = path.join(tempDir, 'timeout-outputs');

    const result = await adapter.render({
      artifact: { id: 'timeout-docx', srcPath: artifactPath, type: 'docx' },
      outDir,
      signal: new AbortController().signal,
      dryRun: false
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Timed out');
    expect(result.errors?.[0]?.details).toContain('Timed out');
  });
});
