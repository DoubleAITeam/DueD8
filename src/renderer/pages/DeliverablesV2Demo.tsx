import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { featureFlags } from '../../shared/featureFlags';
import { useStore } from '../state/store';

const ASSIGNMENT_ID = 'demo-assignment-001';
const CANVAS_FILE_ID = 'demo-file-001';
const PROMPT = 'Draft a comprehensive assignment response summarising Canvas materials.';

type ArtifactRow = {
  artifactId: string;
  type: 'docx' | 'pdf';
  status: 'pending' | 'valid' | 'failed';
  signedUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  bytes: number;
  validatedAt: string | null;
  mime: string;
};

function ArtifactTableRow({ artifact, onDownload }: { artifact: ArtifactRow; onDownload: (artifact: ArtifactRow) => void }) {
  const gate = useArtifactGate(artifact);
  const statusColor = artifact.status === 'valid' ? '#047857' : artifact.status === 'failed' ? '#b91c1c' : '#1d4ed8';
  const statusLabel = artifact.status === 'valid' ? 'Validated' : artifact.status === 'failed' ? artifact.errorCode || 'Failed' : 'Pending validation';

  const handleClick = async () => {
    if (!artifact.signedUrl || !gate.canDownload) {
      await window.dued8.deliverables.telemetryBlocked({ reason: gate.reason ?? 'unknown' });
      return;
    }
    onDownload(artifact);
  };

  return (
    <tr style={{ borderTop: '1px solid var(--surface-border)' }}>
      <td style={{ padding: '12px 16px' }}>{artifact.type.toUpperCase()}</td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ color: statusColor }}>{statusLabel}</span>
        {!gate.canDownload && artifact.status !== 'failed' ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Waiting for validation…</div>
        ) : null}
        {artifact.status === 'failed' && artifact.errorMessage ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{artifact.errorMessage}</div>
        ) : null}
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{(artifact.bytes / 1024).toFixed(1)} KB</td>
      <td style={{ padding: '12px 16px' }}>
        <button type="button" onClick={handleClick} disabled={!artifact.signedUrl}>
          Download
        </button>
      </td>
    </tr>
  );
}

function decodeBuffer(bufferPayload: { type: string; data: number[] }) {
  return Uint8Array.from(bufferPayload.data);
}

export default function DeliverablesV2Demo() {
  const setToast = useStore((s) => s.setToast);
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [blobMap, setBlobMap] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      Object.values(blobMap).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [blobMap]);

  const refreshArtifacts = useCallback(async () => {
    const response = await window.dued8.deliverables.listArtifacts({ assignmentId: ASSIGNMENT_ID });
    if (!response.ok) {
      throw new Error(response.error || 'Failed to load artifacts');
    }
    const mapped: ArtifactRow[] = response.data.map((record) => ({
      artifactId: record.artifactId,
      type: record.type,
      status: record.status,
      signedUrl: record.signedUrl,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      bytes: record.bytes,
      validatedAt: record.validatedAt ?? null,
      mime: record.mime
    }));
    setArtifacts(mapped);
  }, []);

  const runPipeline = useCallback(async () => {
    setStatus('running');
    setError(null);
    try {
      const result = await window.dued8.deliverables.runDemo({
        assignmentId: ASSIGNMENT_ID,
        canvasFileId: CANVAS_FILE_ID,
        prompt: PROMPT
      });
      if (!result.ok) {
        throw new Error(result.error || 'Pipeline failed');
      }
      await refreshArtifacts();
      setStatus('ready');
      setToast('Artifacts generated and validated');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }, [refreshArtifacts, setToast]);

  const regenerate = useCallback(async () => {
    setStatus('running');
    setError(null);
    try {
      const result = await window.dued8.deliverables.regenerateDemo({
        assignmentId: ASSIGNMENT_ID,
        canvasFileId: CANVAS_FILE_ID,
        prompt: PROMPT
      });
      if (!result.ok) {
        throw new Error(result.error || 'Failed to regenerate');
      }
      await refreshArtifacts();
      setStatus('ready');
      setToast('Artifacts regenerated');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }, [refreshArtifacts, setToast]);

  const downloadArtifact = useCallback(
    async (artifact: ArtifactRow) => {
      if (!artifact.signedUrl) {
        return;
      }
      try {
        const response = await window.dued8.deliverables.downloadSigned({
          artifactId: artifact.artifactId,
          assignmentId: ASSIGNMENT_ID,
          source: 'demo'
        });
        if (!response.ok) {
          throw new Error(response.error || 'Failed to download');
        }
        const buffer = decodeBuffer(response.data.buffer as unknown as { type: string; data: number[] });
        const blob = new Blob([buffer], { type: artifact.mime });
        const url = URL.createObjectURL(blob);
        setBlobMap((prev) => {
          const next = { ...prev };
          if (prev[artifact.artifactId]) {
            URL.revokeObjectURL(prev[artifact.artifactId]);
          }
          next[artifact.artifactId] = url;
          return next;
        });
        const link = document.createElement('a');
        link.href = url;
        link.download = artifact.type === 'pdf' ? 'deliverable.pdf' : 'deliverable.docx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        setToast(`Download failed: ${(err as Error).message}`);
      }
    },
    [setToast]
  );

  useEffect(() => {
    void refreshArtifacts();
  }, [refreshArtifacts]);

  const showPreparing = useMemo(() => artifacts.some((artifact) => artifact.status === 'pending'), [artifacts]);
  const showErrorState = status === 'error' || artifacts.some((artifact) => artifact.status === 'failed');

  if (!featureFlags.deliverablesV2Demo) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Deliverables V2 Demo</h1>
        <p>This demo route is disabled. Enable the deliverablesV2Demo flag to continue.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0 }}>Deliverables V2 Vertical Slice</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ingests a Canvas file, generates structured JSON, renders DOCX/PDF, validates both, and only exposes
          downloads after validation.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={runPipeline} disabled={status === 'running'}>
          {status === 'running' ? 'Running…' : 'Start demo run'}
        </button>
        <button type="button" onClick={regenerate} disabled={status === 'running'}>
          Regenerate
        </button>
      </div>

      {showPreparing ? (
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(59, 130, 246, 0.08)', color: '#1d4ed8' }}>
          Preparing file – validation in progress…
        </div>
      ) : null}

      {showErrorState ? (
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(220, 38, 38, 0.08)', color: '#b91c1c' }}>
          {error || 'Artifact validation failed. Use Regenerate to retry.'}
        </div>
      ) : null}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid var(--surface-border)'
        }}
      >
        <thead style={{ background: 'rgba(0,0,0,0.04)' }}>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Artifact</th>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Size</th>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((artifact) => (
            <ArtifactTableRow key={artifact.artifactId} artifact={artifact} onDownload={downloadArtifact} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
