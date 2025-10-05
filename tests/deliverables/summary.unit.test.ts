import { describe, expect, it } from 'vitest';
import { buildRunSummary } from '../../electron/deliverables/summary';
import type { DeliverableRunRecord } from '../../electron/deliverables/types';

describe('buildRunSummary', () => {
  it('summarises successful runs', () => {
    const started = Date.now();
    const run: DeliverableRunRecord = {
      runId: 'run-ok',
      startedAt: started,
      finishedAt: started + 2500,
      results: [
        {
          id: 'a',
          type: 'pdf',
          success: true,
          message: 'done',
          outputPath: '/tmp/a.pdf',
          badge: 'success'
        },
        {
          id: 'b',
          type: 'html',
          success: true,
          message: 'done',
          outputPath: '/tmp/b.html',
          badge: 'success'
        }
      ]
    };

    const summary = buildRunSummary(run);
    expect(summary.runId).toBe('run-ok');
    expect(summary.totals).toEqual({
      count: 2,
      ok: 2,
      failed: 0,
      cancelled: 0,
      skipped: 0
    });
    expect(summary.byType.pdf.ok).toBe(1);
    expect(summary.headline).toContain('Processed 2 artifacts');
    expect(summary.bullets.length).toBeGreaterThanOrEqual(3);
    expect(summary.bullets.length).toBeLessThanOrEqual(6);
  });

  it('accounts for failures and fallbacks', () => {
    const now = Date.now();
    const run: DeliverableRunRecord = {
      runId: 'run-mixed',
      startedAt: now,
      finishedAt: now + 5000,
      results: [
        {
          id: 'doc-1',
          type: 'docx',
          success: false,
          message: 'Adapter failed',
          adapterId: 'libre',
          attempts: 2,
          attempted: ['copy-docx', 'libre'],
          badge: 'error'
        },
        {
          id: 'pdf-1',
          type: 'pdf',
          success: true,
          adapterId: 'copy-pdf',
          attempts: 1,
          attempted: ['copy-pdf'],
          badge: 'success'
        }
      ]
    };

    const summary = buildRunSummary(run);
    expect(summary.totals.failed).toBe(1);
    expect(summary.fallbackCount).toBe(1);
    expect(summary.headline).toContain('failures');
    expect(summary.headline).toContain('fallbacks');
    expect(summary.adaptersUsed['copy-pdf']).toBe(1);
    expect(summary.adaptersUsed.libre).toBe(1);
  });

  it('identifies cancelled work', () => {
    const start = Date.now();
    const run: DeliverableRunRecord = {
      runId: 'run-cancel',
      startedAt: start,
      finishedAt: start + 1000,
      results: [
        {
          id: 'html-1',
          type: 'html',
          success: false,
          message: 'Render aborted before completion.',
          badge: 'cancelled'
        },
        {
          id: 'html-2',
          type: 'html',
          success: true,
          message: 'done',
          badge: 'success'
        }
      ]
    };

    const summary = buildRunSummary(run);
    expect(summary.totals.cancelled).toBe(1);
    expect(summary.headline).toContain('Run cancelled');
  });
});
