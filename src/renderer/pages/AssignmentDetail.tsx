import React, { useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore } from '../state/store';

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt'];

type Props = {
  assignment: Assignment | null;
  courseName?: string;
  onBack: () => void;
  backLabel?: string;
};

export default function AssignmentDetail({ assignment, courseName, onBack, backLabel }: Props) {
  const appendAssignmentContext = useStore((s) => s.appendAssignmentContext);
  const assignmentContexts = useStore((s) =>
    assignment ? s.assignmentContexts[assignment.id] ?? [] : []
  );
  const setToast = useStore((s) => s.setToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dueText = useMemo(() => {
    if (!assignment?.due_at) {
      return 'No due date provided – double-check in Canvas.';
    }
    return new Date(assignment.due_at).toLocaleString();
  }, [assignment]);

  if (!assignment) {
    return (
      <section
        style={{
          background: 'var(--surface-card)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          border: '1px solid var(--surface-border)'
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid var(--surface-border)',
            borderRadius: 999,
            padding: '8px 16px',
            cursor: 'pointer',
            marginBottom: 24
          }}
        >
          ← {backLabel ?? 'Back to dashboard'}
        </button>
        <h2 style={{ marginTop: 0 }}>Assignment not found</h2>
        <p>We could not load the selected assignment. Please return to the dashboard.</p>
      </section>
    );
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const supported = files.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return Boolean(ext && SUPPORTED_EXTENSIONS.includes(ext));
    });

    if (!supported.length) {
      setError('Only PDF, DOCX, or TXT files are supported.');
      setStatus('error');
      return;
    }

    setProcessing(true);
    setStatus('idle');
    setError(null);

    try {
      const directResults: Array<{ fileName: string; content: string }> = [];
      const descriptors: Array<{ path: string; name: string; type?: string }> = [];

      for (const file of supported) {
        const withPath = file as File & { path?: string };
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'txt' && !withPath.path) {
          // PHASE 2: Fall back to renderer parsing when Electron omits the filesystem path.
          const text = (await file.text()).trim();
          if (text.length) {
            directResults.push({ fileName: file.name, content: text });
          }
          continue;
        }
        if (!withPath.path) {
          throw new Error(`Cannot process ${file.name} because no secure path was provided.`);
        }
        descriptors.push({ path: withPath.path, name: file.name, type: file.type });
      }

      let processed: Array<{ fileName: string; content: string }> = [];
      if (descriptors.length) {
        const response = await window.dued8.files.processUploads(descriptors);
        if (!response.ok) {
          throw new Error(response.error);
        }
        processed = response.data;
      }

      const combined = [...directResults, ...processed].filter((entry) => entry.content.length);
      if (!combined.length) {
        throw new Error('We could not extract readable text from those files.');
      }

      appendAssignmentContext(
        assignment.id,
        combined.map((entry) => ({ ...entry, uploadedAt: Date.now() }))
      );
      setToast(
        `${combined.length} file${combined.length > 1 ? 's' : ''} processed for ${assignment.name}.`
      );
      setStatus('success');
    } catch (err) {
      setError((err as Error).message || 'File processing failed.');
      setToast('File processing failed.');
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <section
      style={{
        background: 'var(--surface-card)',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        border: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: '1px solid var(--surface-border)',
              borderRadius: 999,
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            ← {backLabel ?? 'Back to dashboard'}
          </button>
          <h2 style={{ margin: 0 }}>{assignment.name}</h2>
          <div style={{ color: 'var(--text-secondary)' }}>
            {courseName ? `${courseName} · ` : ''}Due: {dueText}
          </div>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--surface-border)'}`,
          borderRadius: 20,
          padding: 32,
          background: dragging ? 'rgba(10, 132, 255, 0.08)' : 'rgba(255,255,255,0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
          transition: 'background 0.2s ease, border 0.2s ease'
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Drag & drop PDF, DOCX, or TXT files</p>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          {/* PHASE 2: Reinforce the drop target with an alternate upload path. */}
          or
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '10px 22px',
            cursor: 'pointer',
            boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)'
          }}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={(event) => {
            handleFiles(event.target.files ?? []);
            event.target.value = '';
          }}
        />
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {processing ? 'Processing files…' : 'We will extract text automatically for the chatbot.'}
        </div>
      </div>

      {status === 'success' && !processing ? (
        <div style={{ color: '#047857', background: 'rgba(16,185,129,0.12)', padding: '12px 16px', borderRadius: 14 }}>
          Files processed and ready for the chatbot.
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div style={{ color: '#b91c1c', background: 'rgba(239,68,68,0.12)', padding: '12px 16px', borderRadius: 14 }}>
          {error}
        </div>
      ) : null}

      <div>
        <h3 style={{ marginTop: 0 }}>Uploaded context</h3>
        {assignmentContexts.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignmentContexts.map((entry) => (
              <li
                key={`${entry.fileName}-${entry.uploadedAt}`}
                style={{
                  border: '1px solid var(--surface-border)',
                  borderRadius: 14,
                  padding: '16px',
                  background: 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ fontWeight: 600 }}>{entry.fileName}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {new Date(entry.uploadedAt).toLocaleString()}
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {entry.content.slice(0, 260)}{entry.content.length > 260 ? '…' : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>
            {/* PHASE 2: Set expectations when no context has been uploaded yet. */}
            No supporting files yet. Add documents to help the chatbot prepare richer answers.
          </p>
        )}
      </div>
    </section>
  );
}
