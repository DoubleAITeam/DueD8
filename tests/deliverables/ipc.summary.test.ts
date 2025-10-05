import fs from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import { buildRunSummary } from '../../electron/deliverables/summary';
import { getSummary, resetRuns, saveRun, saveSummary } from '../../electron/deliverables/dataStore';
import type {
  DeliverableRunRecord,
  RunSummary,
  AiSummaryPayload
} from '../../electron/deliverables/types';

const { tempDir, handlers } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-ipc-'));
  const handlerMap: Record<string, (...args: unknown[]) => unknown> = {};
  return { tempDir: dir, handlers: handlerMap };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
    removeHandler: vi.fn()
  }
}));

import '../../electron/deliverables/ipc';

describe('deliverables summary ipc', () => {
  const run: DeliverableRunRecord = {
    runId: 'ipc-run',
    startedAt: 1000,
    finishedAt: 4000,
    results: [
      {
        id: 'a',
        type: 'pdf',
        success: true,
        message: 'done',
        badge: 'success'
      }
    ]
  };

  beforeEach(async () => {
    await resetRuns();
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
    await saveRun(run);
    const summary = buildRunSummary(run);
    await saveSummary(run.runId, summary);
    resetDeliverablesConfigCache();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns stored summaries', async () => {
    const handler = handlers['deliverables:getSummary'] as
      | ((_: unknown, runId: string) => Promise<RunSummary | null>)
      | undefined;
    expect(handler).toBeDefined();
    if (!handler) return;
    const result = await handler(null, run.runId);
    expect(result?.runId).toBe(run.runId);
    expect(result?.totals.ok).toBe(1);
  });

  it('rebuilds summaries deterministically', async () => {
    await saveSummary(run.runId, {
      ...buildRunSummary(run),
      headline: 'stale'
    });
    const handler = handlers['deliverables:rebuildSummary'] as
      | ((_: unknown, runId: string) => Promise<RunSummary | null>)
      | undefined;
    expect(handler).toBeDefined();
    if (!handler) return;
    const rebuilt = await handler(null, run.runId);
    expect(rebuilt?.headline).not.toBe('stale');

    const stored = await getSummary(run.runId);
    expect(stored?.headline).toBe(rebuilt?.headline);
  });

  it('exports HTML reports', async () => {
    const handler = handlers['deliverables:exportReport'] as
      | ((_: unknown, runId: string, format?: 'html' | 'json') => Promise<string>)
      | undefined;
    expect(handler).toBeDefined();
    if (!handler) return;
    const outputPath = await handler(null, run.runId, 'html');
    expect(typeof outputPath).toBe('string');
    if (typeof outputPath === 'string' && outputPath) {
      const contents = await fs.readFile(outputPath, 'utf-8');
      expect(contents).toContain(run.runId);
    }
  });

  it('returns null for AI summary when disabled', async () => {
    delete process.env.DELIV_AI_SUMMARY;
    delete process.env.OPENAI_API_KEY;
    resetDeliverablesConfigCache();
    const handler = handlers['deliverables:getAiSummary'] as
      | ((_: unknown, runId: string) => Promise<AiSummaryPayload | null>)
      | undefined;
    expect(handler).toBeDefined();
    if (!handler) return;
    const ai = await handler(null, run.runId);
    expect(ai).toBeNull();
  });
});
