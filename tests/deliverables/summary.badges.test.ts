import { describe, expect, it } from 'vitest';
import { __determineBadgeForTest } from '../../electron/deliverables/pipeline';
import type { DeliverableJobResult } from '../../electron/deliverables/types';

describe('deliverables badge assignment', () => {
  const base = (overrides: Partial<DeliverableJobResult> & { type?: 'pdf' | 'docx' | 'html' }) => ({
    id: 'artifact',
    success: false,
    type: 'pdf' as const,
    ...overrides
  });

  it('marks successful jobs as success', () => {
    const badge = __determineBadgeForTest(base({ success: true, message: 'ok' }));
    expect(badge).toBe('success');
  });

  it('treats validation failures as skipped', () => {
    const badge = __determineBadgeForTest(
      base({
        message: 'Validation failed (MISSING_FILE)',
        adapterReason: 'Validation failed prior to rendering.'
      })
    );
    expect(badge).toBe('skipped');
  });

  it('flags aborted work as cancelled', () => {
    const badge = __determineBadgeForTest(
      base({ message: 'Render aborted before completion.', success: false })
    );
    expect(badge).toBe('cancelled');
  });

  it('defaults to error for permanent failures', () => {
    const badge = __determineBadgeForTest(
      base({ message: 'Adapter copy-pdf failed hard', errors: [{ code: 'MISSING_FILE' }] })
    );
    expect(badge).toBe('error');
  });
});
