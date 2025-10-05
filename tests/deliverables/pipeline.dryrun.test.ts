import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { runDeliverablePipeline } from '../../electron/deliverables/pipeline';
import { resetRuns, getRuns } from '../../electron/deliverables/dataStore';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-dry-run-'));
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

describe('deliverables pipeline dry run', () => {
  let pdfFile: string;
  let htmlFile: string;

  beforeAll(async () => {
    pdfFile = path.join(tempDir, 'dryrun.pdf');
    htmlFile = path.join(tempDir, 'dryrun.html');
    await fs.writeFile(pdfFile, 'PDF data');
    await fs.writeFile(htmlFile, '<html><body>dry run</body></html>');
    await resetRuns();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes only metadata files and records run context', async () => {
    const artifacts: ArtifactInput[] = [
      { id: 'pdf-dry', srcPath: pdfFile, type: 'pdf' },
      { id: 'html-dry', srcPath: htmlFile, type: 'html' }
    ];

    const result = await runDeliverablePipeline(artifacts, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.run.options?.dryRun).toBe(true);

    const outputDir = path.join(tempDir, 'deliverables', 'outputs', result.run.runId);
    const entries = await fs.readdir(outputDir);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((name) => name.endsWith('.meta.json'))).toBe(true);

    for (const entry of result.run.results) {
      expect(entry.dryRun).toBe(true);
      expect(entry.outputPath).toBeTruthy();
      if (entry.outputPath) {
        const stat = await fs.stat(entry.outputPath);
        expect(stat.isFile()).toBe(true);
        const basePath = entry.outputPath.replace(/\.meta\.json$/, '');
        await expect(fs.access(basePath)).rejects.toThrow();
      }
    }

    const history = await getRuns(1);
    expect(history[0]?.options?.dryRun).toBe(true);
    expect(history[0]?.results.every((job) => job.dryRun === true)).toBe(true);
  });
});

