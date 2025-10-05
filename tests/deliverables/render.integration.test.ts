import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { runDeliverablePipeline } from '../../electron/deliverables/pipeline';
import { getRuns, resetRuns } from '../../electron/deliverables/dataStore';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-render-'));
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

describe('deliverables pipeline integration', () => {
  let htmlFile: string;
  let docxFile: string;

  beforeAll(async () => {
    htmlFile = path.join(tempDir, 'integration.html');
    docxFile = path.join(tempDir, 'notes.docx');

    await fs.writeFile(htmlFile, '<html><body>integration</body></html>');
    await fs.writeFile(docxFile, 'DOCX data');

    await resetRuns();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('runs the full pipeline and persists outputs', async () => {
    const artifacts: ArtifactInput[] = [
      { id: 'html-artifact', srcPath: htmlFile, type: 'html' },
      { id: 'docx-artifact', srcPath: docxFile, type: 'docx' },
      { id: 'missing-artifact', srcPath: path.join(tempDir, 'missing.pdf'), type: 'pdf' }
    ];

    const result = await runDeliverablePipeline(artifacts);

    expect(result.run.results).toHaveLength(artifacts.length);
    expect(result.run.results.map((r) => r.id)).toEqual(artifacts.map((artifact) => artifact.id));
    expect(result.run.options?.dryRun).toBe(false);

    const outputDir = path.join(tempDir, 'deliverables', 'outputs', result.run.runId);
    const outputDirStat = await fs.stat(outputDir);
    expect(outputDirStat.isDirectory()).toBe(true);

    const validResults = result.run.results.filter((entry) => entry.success);
    expect(validResults).toHaveLength(2);
    expect(validResults.every((entry) => typeof entry.adapterId === 'string')).toBe(true);

    for (const entry of validResults) {
      expect(entry.outputPath).toBeTruthy();
      const stat = await fs.stat(entry.outputPath!);
      expect(stat.isFile()).toBe(true);
    }

    const missingResult = result.run.results.find((entry) => entry.id === 'missing-artifact');
    expect(missingResult?.success).toBe(false);
    expect(missingResult?.outputPath).toBeUndefined();
    expect(missingResult?.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_FILE' })])
    );

    const runs = await getRuns(5);
    expect(runs[0]?.runId).toBe(result.run.runId);
  });
});
