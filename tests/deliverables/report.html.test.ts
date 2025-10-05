import fs from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeRunReport } from '../../electron/deliverables/report';
import { buildRunSummary } from '../../electron/deliverables/summary';
import type { DeliverableRunRecord } from '../../electron/deliverables/types';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-report-'));
  return { tempDir: dir };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  }
}));

describe('writeRunReport', () => {
  const run: DeliverableRunRecord = {
    runId: 'run-report',
    startedAt: 1000,
    finishedAt: 4000,
    results: [
      {
        id: 'pdf-1',
        type: 'pdf',
        success: true,
        badge: 'success',
        adapterId: 'copy-pdf',
        attempts: 1,
        attempted: ['copy-pdf'],
        message: 'done'
      }
    ]
  };

  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('produces an HTML report with summary details', async () => {
    const summary = buildRunSummary(run);
    const outputPath = await writeRunReport(run, summary, { format: 'html' });
    expect(outputPath).toMatch(/run-report\.html$/);

    const contents = await fs.readFile(outputPath, 'utf-8');
    expect(contents).toContain('Deliverables Run run-report');
    expect(contents).toContain(summary.headline);
    expect(contents).toContain('copy-pdf');
    expect(contents).toContain('pdf-1');
  });
});
