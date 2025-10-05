import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableJobResult, DeliverableRunRecord } from '../../electron/deliverables/types';
import { getRuns, resetRuns, saveRun } from '../../electron/deliverables/dataStore';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-data-store-'));
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

describe('deliverables data store', () => {
  beforeEach(async () => {
    await resetRuns();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists and retrieves run records', async () => {
    const baseResult: DeliverableJobResult & { type: 'html' } = {
      id: 'artifact-1',
      success: true,
      message: 'ok',
      outputPath: '/tmp/out.html',
      type: 'html'
    };

    const run: DeliverableRunRecord = {
      runId: 'run-1',
      startedAt: Date.now(),
      finishedAt: Date.now() + 5,
      results: [baseResult]
    };

    await saveRun(run);

    const runs = await getRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.runId).toBe('run-1');
    expect(runs[0]?.results[0]?.id).toBe('artifact-1');
  });

  it('respects retrieval limits and ordering', async () => {
    const now = Date.now();
    const runA: DeliverableRunRecord = {
      runId: 'run-a',
      startedAt: now,
      finishedAt: now + 10,
      results: [
        {
          id: 'a',
          success: false,
          message: 'failed',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'not found'
            }
          ]
        }
      ]
    };

    const runB: DeliverableRunRecord = {
      runId: 'run-b',
      startedAt: now + 100,
      finishedAt: now + 200,
      results: [
        {
          id: 'b',
          success: true,
          message: 'ok',
          outputPath: '/tmp/out.pdf'
        }
      ]
    };

    await saveRun(runA);
    await saveRun(runB);

    const allRuns = await getRuns();
    expect(allRuns[0]?.runId).toBe('run-b');
    expect(allRuns[1]?.runId).toBe('run-a');

    const limited = await getRuns(1);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.runId).toBe('run-b');
  });
});
