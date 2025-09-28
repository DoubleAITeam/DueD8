import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useArtifactGate } from '../renderer/lib/useArtifactGate';

describe('useArtifactGate', () => {
  it('blocks download when validatedAt is missing', () => {
    const artifact = {
      status: 'valid' as const,
      validatedAt: null,
      mime: 'application/pdf',
      signedUrl: 'local-signed://abc'
    };

    const { result } = renderHook(({ value }) => useArtifactGate(value), {
      initialProps: { value: artifact }
    });

    expect(result.current.canDownload).toBe(false);
    expect(result.current.reason).toBe('missing_validated_at');
  });

  it('allows download when artifact is fully validated', () => {
    const artifact = {
      status: 'valid' as const,
      validatedAt: new Date().toISOString(),
      mime: 'application/pdf',
      signedUrl: 'local-signed://ready'
    };

    const { result } = renderHook(({ value }) => useArtifactGate(value), {
      initialProps: { value: artifact }
    });

    expect(result.current.canDownload).toBe(true);
    expect(result.current.reason).toBeNull();
  });
});
