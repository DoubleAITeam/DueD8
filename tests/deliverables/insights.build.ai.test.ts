import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import type { DeliverableRunRecord } from '../../electron/deliverables/types';
import { buildAiInsights, buildBaseInsights, loadInsightBundle } from '../../electron/deliverables/insights/build';
import { saveRun } from '../../electron/deliverables/dataStore';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'insights-build-ai-'));
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

describe('insights AI builder', () => {
  const artifactPath = path.join(tempDir, 'artifact.html');
  const run: DeliverableRunRecord = {
    runId: 'ai-run',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    results: [
      {
        id: 'artifact-ai',
        success: true,
        outputPath: artifactPath,
        type: 'html'
      }
    ]
  };

  beforeAll(async () => {
    await fs.writeFile(
      artifactPath,
      '<html><head><title>AI Ready</title></head><body><p>HIST-300-100 summary of A5 topics.</p></body></html>'
    );
    await saveRun(run);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.DELIV_AI_INSIGHTS = '1';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.DELIV_AI_INSIGHTS_TIMEOUT_MS = '20';
    resetDeliverablesConfigCache();
  });

  afterEach(() => {
    delete process.env.DELIV_AI_INSIGHTS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DELIV_AI_INSIGHTS_TIMEOUT_MS;
    resetDeliverablesConfigCache();
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    vi.useRealTimers();
  });

  it('requests AI insights and merges results', async () => {
    await buildBaseInsights(run);
    const bundle = (await loadInsightBundle(run.runId))!;

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse((init?.body as string) ?? '{}');
        expect(body.messages[1]?.content).toContain('AI Ready');
        return {
          ok: true,
          json: async () => ({
            model: 'mock-model',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'Concise summary',
                    actionItems: ['Review notes'],
                    confidence: 0.75
                  })
                }
              }
            ]
          })
        } as Response;
      });

    vi.stubGlobal('fetch', fetchMock);

    await buildAiInsights(run.runId, bundle);
    const persisted = await loadInsightBundle(run.runId);
    expect(persisted?.ai?.['artifact-ai']?.summary).toBe('Concise summary');
    expect(persisted?.ai?.['artifact-ai']?.actionItems).toEqual(['Review notes']);
    expect(persisted?.ai?.['artifact-ai']?.model).toBe('mock-model');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
  });

  it('honours timeouts and continues gracefully', async () => {
    await buildBaseInsights(run);
    const bundle = (await loadInsightBundle(run.runId))!;

    const fetchMock = vi.fn<typeof fetch>(
      (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );

    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const promise = buildAiInsights(run.runId, bundle);
    vi.runAllTimers();
    const updated = await promise;

    expect(updated.ai?.['artifact-ai']).toBeUndefined();

    vi.useRealTimers();
  });
});
