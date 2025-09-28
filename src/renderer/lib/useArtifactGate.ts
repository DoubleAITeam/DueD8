import { useMemo } from 'react';

type ArtifactLike = {
  status: 'pending' | 'valid' | 'failed';
  validatedAt: string | null;
  mime?: string | null;
  signedUrl?: string | null;
};

type GateResult = {
  canDownload: boolean;
  reason: string | null;
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

export function useArtifactGate(artifact: ArtifactLike | null | undefined): GateResult {
  return useMemo(() => {
    if (!artifact) {
      return { canDownload: false, reason: 'missing_artifact' };
    }
    if (artifact.status !== 'valid') {
      return { canDownload: false, reason: `status_${artifact.status}` };
    }
    if (!artifact.validatedAt) {
      return { canDownload: false, reason: 'missing_validated_at' };
    }
    if (!artifact.signedUrl) {
      return { canDownload: false, reason: 'missing_signed_url' };
    }
    if (artifact.mime && !ALLOWED_MIME.has(artifact.mime)) {
      return { canDownload: false, reason: 'mime_not_allowed' };
    }
    return { canDownload: true, reason: null };
  }, [artifact]);
}

export { ALLOWED_MIME };
