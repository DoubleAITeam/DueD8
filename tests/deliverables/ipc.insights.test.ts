import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DeliverableRunRecord } from '../../electron/deliverables/types';
import { saveRun } from '../../electron/deliverables/dataStore';

const { tempDir, handlers } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'ipc-insights-'));
  const map = new Map<string, unknown>();
  return { tempDir: dir, handlers: map };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  },
  ipcMain: {
    handle: (channel: string, handler: unknown) => {
      handlers.set(channel, handler);
    },
    removeHandler: vi.fn()
  }
}));

describe('deliverables insights ipc handlers', () => {
  const artifactPath = path.join(tempDir, 'ipc.html');
  const runId = 'ipc-run';

  beforeAll(async () => {
    await fs.writeFile(
      artifactPath,
      '<html><head><title>IPC</title></head><body><p>PHYS-400-123 assignment B2.</p></body></html>'
    );
    const run: DeliverableRunRecord = {
      runId,
      startedAt: Date.now(),
      finishedAt: Date.now(),
      results: [
        {
          id: 'ipc-artifact',
          success: true,
          outputPath: artifactPath,
          type: 'html'
        }
      ]
    };
    await saveRun(run);
    await import('../../electron/deliverables/ipc');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds, retrieves, and corrects insights via ipc', async () => {
    const buildBase = handlers.get('deliverables:buildBaseInsights') as (
      _event: unknown,
      runId: string
    ) => Promise<unknown>;
    const bundle = (await buildBase(null, runId)) as { base: Record<string, unknown> };
    expect(bundle.base['ipc-artifact']).toBeDefined();

    const getInsights = handlers.get('deliverables:getInsights') as (
      _event: unknown,
      runId: string
    ) => Promise<unknown>;
    const fetched = (await getInsights(null, runId)) as { base: Record<string, { title?: string }> };
    expect(fetched.base['ipc-artifact']?.title).toBe('IPC');

    const saveCorrection = handlers.get('deliverables:saveInsightCorrection') as (
      _event: unknown,
      runId: string,
      artifactId: string,
      patch: { title?: string }
    ) => Promise<unknown>;
    const updated = (await saveCorrection(null, runId, 'ipc-artifact', { title: 'Updated' })) as {
      base: Record<string, { title?: string }>;
    };
    expect(updated.base['ipc-artifact']?.title).toBe('Updated');

    const aiEnabled = handlers.get('deliverables:isAiInsightsEnabled') as () => Promise<boolean>;
    expect(await aiEnabled()).toBe(false);

    const redactionInfo = handlers.get('deliverables:getInsightRedactionInfo') as () => Promise<{
      enabled: boolean;
      patterns: string[];
    }>;
    const info = await redactionInfo();
    expect(info.patterns.length).toBeGreaterThan(0);

    const buildAi = handlers.get('deliverables:buildAiInsights') as (
      _event: unknown,
      runId: string
    ) => Promise<unknown>;
    const aiResult = await buildAi(null, runId);
    expect(aiResult).toMatchObject(updated);
  });
});
