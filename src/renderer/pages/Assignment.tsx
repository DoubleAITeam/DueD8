import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rendererError, rendererLog } from '../../lib/logger';
import type { AssignmentDetail } from '../../shared/types';
import { useStore } from '../state/store';

const dued8 = window.dued8;

type FileDescriptor = { path: string; name: string };

export default function AssignmentView() {
  const view = useStore((s) => s.view);
  const setToast = useStore((s) => s.setToast);
  const navigateToCourse = useStore((s) => s.navigateToCourse);
  const navigateToDashboard = useStore((s) => s.navigateToDashboard);

  const [details, setDetails] = useState<AssignmentDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const assignment = view.name === 'assignment' ? view.assignment : null;
  const course = view.name === 'assignment' ? view.course : null;

  const loadDetails = useCallback(async () => {
    if (!assignment) return;
    setLoadingDetails(true);
    try {
      const result = await dued8.files.getAssignmentDetails(assignment.id);
      if (result.ok) {
        setDetails(result.data ?? null);
        if (result.data) {
          rendererLog('Loaded assignment details', assignment.id);
        }
      } else {
        setToast('Unable to read stored assignment details.');
        rendererError('Failed loading assignment details', result.error);
      }
    } catch (err) {
      rendererError('Unexpected assignment detail error', err);
      setToast('Unable to read stored assignment details.');
    } finally {
      setLoadingDetails(false);
    }
  }, [assignment, setToast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleFiles = useCallback(
    async (files: FileDescriptor[]) => {
      if (!assignment || !course || !files.length) return;
      setProcessing(true);
      setError(null);
      try {
        const result = await dued8.files.processAssignmentFiles({
          assignmentId: assignment.id,
          courseId: course.id,
          files
        });
        if (result.ok) {
          setDetails(result.data);
          setToast('Files processed successfully.');
        } else {
          setError(result.error ?? 'File processing failed.');
          setToast('Unable to process the selected files.');
        }
      } catch (err) {
        rendererError('Unexpected processing error', err);
        setError((err as Error).message);
        setToast('Unable to process the selected files.');
      } finally {
        setProcessing(false);
      }
    },
    [assignment, course, setToast]
  );

  const extractFiles = useCallback(
    (list: FileList | null): FileDescriptor[] => {
      if (!list) return [];
      const descriptors: FileDescriptor[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const file = list.item(i);
        if (!file) continue;
        const fileWithPath = file as File & { path?: string };
        if (!fileWithPath.path) {
          rendererLog('Dropped file missing path; skipping', file.name);
          continue;
        }
        descriptors.push({ path: fileWithPath.path, name: file.name });
      }
      return descriptors;
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = extractFiles(event.dataTransfer?.files ?? null);
      if (!dropped.length) {
        setError('No readable files were dropped.');
        return;
      }
      void handleFiles(dropped);
    },
    [extractFiles, handleFiles]
  );

  if (!assignment || !course) {
    return (
      <div style={{ padding: 32 }}>
        <button
          type="button"
          onClick={navigateToDashboard}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#2563eb',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        <p style={{ marginTop: 24 }}>Select an assignment to view details.</p>
      </div>
    );
  }

  const prettyDue = assignment.due_at
    ? new Date(assignment.due_at).toLocaleString()
    : 'No due date provided';

  const latestFiles = useMemo(() => details?.files ?? [], [details]);

  return (
    <div style={{ padding: 32, minHeight: '100vh', background: '#f8fafc' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigateToCourse(course)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#2563eb',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            ← Back to Course
          </button>
          <button
            type="button"
            onClick={navigateToDashboard}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#2563eb',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            ⮐ Dashboard
          </button>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>{assignment.name}</h1>
          <div style={{ color: '#475569' }}>{prettyDue}</div>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 3fr' }}>
        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDrop}
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
            border: dragActive ? '2px dashed #2563eb' : '2px dashed #cbd5f5',
            transition: 'border 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div style={{ textAlign: 'center', color: '#475569', lineHeight: 1.5 }}>
            <strong>Drag &amp; drop files</strong>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              Drop PDFs, text files, or notes to process with the assignment pipeline.
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: processing ? '#94a3b8' : '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: processing ? 'wait' : 'pointer'
            }}
          >
            {processing ? 'Processing…' : 'Select files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => {
              const picked = extractFiles(event.target.files);
              if (picked.length) {
                void handleFiles(picked);
              }
              event.target.value = '';
            }}
          />
          {error ? (
            <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>
          ) : null}
        </section>

        <section
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 280
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Details</h2>
            <span style={{ color: '#64748b', fontSize: 13 }}>
              {loadingDetails ? 'Loading…' : details ? `Updated ${new Date(details.updatedAt).toLocaleString()}` : 'No data stored yet'}
            </span>
          </header>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {details?.extractedText?.trim() ? details.extractedText : 'No extracted text available yet.'}
          </div>
          {latestFiles.length ? (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Processed files</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 13 }}>
                {latestFiles.map((file) => (
                  <li key={`${file.path}-${file.processedAt}`}>
                    {file.name}{' '}
                    <span style={{ color: '#64748b' }}>
                      ({Math.round(file.size / 1024)} KB · {new Date(file.processedAt).toLocaleString()})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
