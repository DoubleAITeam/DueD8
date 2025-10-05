import { describe, expect, it } from 'vitest';
import copyDocxAdapter from '../../electron/deliverables/renderers/copyDocx';
import copyPdfAdapter from '../../electron/deliverables/renderers/copyPdf';
import staticHtmlAdapter from '../../electron/deliverables/renderers/staticHtml';

describe('deliverable adapters health checks', () => {
  const adapters = [copyPdfAdapter, copyDocxAdapter, staticHtmlAdapter];

  it('report healthy status without throwing', async () => {
    for (const adapter of adapters) {
      await expect(adapter.health()).resolves.toMatchObject({ ok: true });
    }
  });
});

