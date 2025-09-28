import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeliverablesV2Demo from '../renderer/pages/DeliverablesV2Demo';

const noop = () => Promise.resolve({ ok: true, data: [] });

declare global {
  interface Window {
    dued8: typeof window.dued8;
  }
}

describe('DeliverablesV2Demo UI', () => {
  beforeEach(() => {
    window.dued8 = {
      ping: () => Promise.resolve('pong'),
      canvas: {} as never,
      students: {} as never,
      events: {} as never,
      attendance: {} as never,
      files: {} as never,
      assignments: {} as never,
      deliverables: {
        runDemo: vi.fn().mockResolvedValue({ ok: false, error: 'INGEST_BAD_RESPONSE: 302 HTML redirect' }),
        regenerateDemo: vi.fn().mockResolvedValue({ ok: true, data: { artifacts: [] } }),
        listArtifacts: vi.fn().mockImplementation(noop),
        downloadSigned: vi.fn().mockResolvedValue({ ok: false, error: 'No URL' })
      }
    } as unknown as typeof window.dued8;
  });

  it('surfaces failure state and keeps regenerate available when ingest fails', async () => {
    render(<DeliverablesV2Demo />);

    fireEvent.click(screen.getByRole('button', { name: 'Start demo run' }));

    await waitFor(() => {
      expect(screen.getByText(/302 HTML redirect/)).toBeInTheDocument();
    });

    const regenerateButton = screen.getByRole('button', { name: 'Regenerate' });
    expect(regenerateButton).toBeEnabled();
  });
});
