import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import { createSolutionArtifact } from '../utils/assignmentSolution';
import { buildSubmissionDraft, type SubmissionDraft } from '../utils/submissionFormatter';
import StudyGuidePanel from '../components/StudyGuidePanel';
import { buildStudyGuidePlan, type StudyGuidePlan } from '../utils/studyGuide';
import { featureFlags } from '../../shared/featureFlags';

const SUPPORTED_EXTENSIONS = ['pdf', 'docx'];
const STUDY_COACH_LABEL = 'Study Coach';

type AttachmentLink = { id: string; name: string; url: string; contentType: string | null };

function ContextList({ entries }: { entries: AssignmentContextEntry[] }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {entries.map((entry) => (
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
            {entry.content.slice(0, 260)}
            {entry.content.length > 260 ? '…' : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AttachmentsCard({
  attachments,
  canvasLink
}: {
  attachments: AttachmentLink[];
  canvasLink: string | null;
}) {
  if (!featureFlags.assignmentSourceLinks) {
    return null;
  }

  const primaryAttachment = attachments[0] ?? null;
  const additionalAttachments = attachments.slice(1);

  if (!primaryAttachment && !canvasLink) {
    return null;
  }

  return (
    <div
      style={{
        border: '1px solid var(--surface-border)',
        borderRadius: 16,
        padding: 20,
        background: 'rgba(255,255,255,0.85)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>Attachments</strong>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Open the original files provided with this assignment.
        </span>
      </div>

      {primaryAttachment ? (
        <a
          key={primaryAttachment.id}
          href={primaryAttachment.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            textDecoration: 'none',
            border: '1px solid var(--surface-border)',
            borderRadius: 12,
            padding: '12px 16px',
            background: '#fff'
          }}
        >
          <span style={{ fontWeight: 600 }}>Original assignment file</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{primaryAttachment.name}</span>
        </a>
      ) : null}

      {additionalAttachments.length ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {additionalAttachments.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                {attachment.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {canvasLink ? (
        <a
          href={canvasLink}
          target="_blank"
          rel="noreferrer"
          style={{
            alignSelf: 'flex-start',
            textDecoration: 'none',
            color: 'var(--accent)',
            fontWeight: 600
          }}
        >
          View on Canvas
        </a>
      ) : null}
    </div>
  );
}

function safeDownloadName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

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
  const submissionUrlsRef = useRef<string[]>([]);
  const lastClassificationSignatureRef = useRef<string | null>(null);
  const classificationRunRef = useRef<number>(0);
  const activeGuideRunRef = useRef<number>(0);
  const activeSubmissionRunRef = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [instructorError, setInstructorError] = useState<string | null>(null);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [guideStatus, setGuideStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [guidePlan, setGuidePlan] = useState<StudyGuidePlan | null>(null);
  const [guideProgress, setGuideProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentLink[]>([]);
  const [canvasLink, setCanvasLink] = useState<string | null>(assignment?.html_url ?? null);
  const [classification, setClassification] = useState<{
    status: 'idle' | 'checking' | 'ready' | 'error';
    type?: 'instructions_only' | 'solvable_assignment';
    confidence?: number;
    reason?: string;
  }>({ status: 'idle' });
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'working' | 'ready' | 'error' | 'cancelled'>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionProgress, setSubmissionProgress] = useState<
    { current: number; total: number; label: string } | null
  >(null);
  const [submissionArtifacts, setSubmissionArtifacts] = useState<
    Array<{ kind: 'google-doc' | 'pdf'; url: string; fileName: string; mimeType: string }>
  >([]);
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft | null>(null);
  const [sourcesMissing, setSourcesMissing] = useState(false);
  const [tokenLimitReached, setTokenLimitReached] = useState(false);

  const dueText = useMemo(() => {
    if (!assignment?.due_at) {
      return 'No due date provided – double-check in Canvas.';
    }
    return new Date(assignment.due_at).toLocaleString();
  }, [assignment]);

  const instructorContexts = useMemo(
    () => assignmentContexts.filter((entry) => entry.source === 'instructor'),
    [assignmentContexts]
  );
  const userContexts = useMemo(
    () => assignmentContexts.filter((entry) => (entry.source ?? 'user') === 'user'),
    [assignmentContexts]
  );
  const hasInstructorContext = instructorContexts.length > 0;
  const combinedContexts = useMemo(
    () => [...instructorContexts, ...userContexts],
    [instructorContexts, userContexts]
  );
  const hasGuideContext = combinedContexts.length > 0;
  const classificationChecking = classification.status === 'checking';
  const instructionsOnly =
    classification.status === 'ready' && classification.type === 'instructions_only';
  const submissionDisabled =
    !hasGuideContext || classificationChecking || instructionsOnly || submissionStatus === 'working';

  useEffect(() => {
    return () => {
      submissionUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      submissionUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    setInstructorError(null);
    setInstructorLoading(false);
    setGuideStatus('idle');
    setGuidePlan(null);
    setGuideProgress(null);
    setGuideError(null);
    activeGuideRunRef.current += 1;
    setAttachments([]);
    setCanvasLink(assignment?.html_url ?? null);
    classificationRunRef.current += 1;
    setClassification({ status: assignment ? 'checking' : 'idle' });
    lastClassificationSignatureRef.current = null;
    submissionUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    submissionUrlsRef.current = [];
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionProgress(null);
    setSubmissionArtifacts([]);
    setSubmissionDraft(null);
    setSourcesMissing(false);
    setTokenLimitReached(false);
  }, [assignment?.id]);

  useEffect(() => {
    if (!hasGuideContext) {
      setGuideExpanded(false);
    }
  }, [hasGuideContext]);

  useEffect(() => {
    let cancelled = false;
    async function loadInstructorContext() {
      if (!assignment || hasInstructorContext) {
        return;
      }
      setInstructorLoading(true);
      setInstructorError(null);
      try {
        const response = await window.dued8.assignments.fetchInstructorContext({
          assignmentId: assignment.id,
          courseId: assignment.course_id
        });
        if (cancelled) return;
        if (!response.ok) {
          setInstructorError(response.error);
          setAttachments([]);
          return;
        }
        const entries = response.data.entries ?? [];
        setAttachments(response.data.attachments ?? []);
        if (typeof response.data.htmlUrl === 'string' && response.data.htmlUrl.length) {
          setCanvasLink(response.data.htmlUrl);
        }
        if (entries.length) {
          appendAssignmentContext(
            assignment.id,
            entries.map((entry) => ({ ...entry, source: 'instructor' as const }))
          );
        }
        } catch (err) {
          if (!cancelled) {
            setInstructorError((err as Error).message);
            setAttachments([]);
          }
      } finally {
        if (!cancelled) {
          setInstructorLoading(false);
        }
      }
    }

    loadInstructorContext();

    return () => {
      cancelled = true;
    };
  }, [assignment, hasInstructorContext, appendAssignmentContext]);

  useEffect(() => {
    if (!assignment) {
      setClassification({ status: 'idle' });
      return;
    }

    const signature = [
      assignment.id,
      ...combinedContexts.map((entry) => `${entry.fileName ?? 'context'}::${entry.uploadedAt ?? 0}::${entry.content.length}`)
    ].join('|');

    if (lastClassificationSignatureRef.current === signature && classification.status !== 'error') {
      if (classification.status === 'ready' || classification.status === 'checking') {
        return;
      }
    }

    lastClassificationSignatureRef.current = signature;
    const runId = Date.now();
    classificationRunRef.current = runId;
    setClassification({ status: 'checking' });
    let cancelled = false;

    (async () => {
      try {
        const response = await window.dued8.assignments.classify({
          assignment: assignment
            ? { name: assignment.name ?? null, description: assignment.description ?? null }
            : null,
          contexts: combinedContexts.map((entry) => ({
            fileName: entry.fileName,
            content: entry.content
          }))
        });
        if (cancelled || classificationRunRef.current !== runId) {
          return;
        }
        if (!response.ok) {
          setClassification({ status: 'error', reason: response.error });
          return;
        }
        setClassification({
          status: 'ready',
          type: response.data.type,
          confidence: response.data.confidence,
          reason: response.data.reason
        });
      } catch (err) {
        if (!cancelled && classificationRunRef.current === runId) {
          setClassification({ status: 'error', reason: (err as Error).message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment, combinedContexts]);

  const handleGenerateSubmission = async () => {
    if (!assignment || !hasGuideContext) {
      return;
    }
    if (instructionsOnly) {
      return;
    }
    if (submissionStatus === 'working') {
      return;
    }
    const runId = Date.now();
    activeSubmissionRunRef.current = runId;
    setSubmissionStatus('working');
    setSubmissionError(null);
    setSubmissionProgress({ current: 0, total: 4, label: 'Analysing assignment materials' });
    submissionUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    submissionUrlsRef.current = [];
    setSubmissionArtifacts([]);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (activeSubmissionRunRef.current !== runId) {
        return;
      }

      const draft = buildSubmissionDraft({
        assignment: assignment ? { name: assignment.name, description: assignment.description } : null,
        courseName,
        dueText,
        contexts: combinedContexts.map((entry) => ({
          fileName: entry.fileName,
          content: entry.content
        })),
        canvasLink,
        attachmentLinks: attachments.map((attachment) => ({ name: attachment.name, url: attachment.url }))
      });

      if (activeSubmissionRunRef.current !== runId) {
        return;
      }

      setSubmissionDraft(draft);
      setSourcesMissing(draft.missingSources);
      setTokenLimitReached(draft.truncated);
      setSubmissionProgress({ current: 1, total: 4, label: 'Structuring submission content' });

      const sanitizedBase = safeDownloadName(assignment.name ?? 'assignment');
      const baseName = sanitizedBase.length ? sanitizedBase : 'assignment';
      const stamp = new Date().toISOString().slice(0, 10);

      const docxArtifact = await createSolutionArtifact({
        extension: 'docx',
        content: draft.content,
        formatting: draft.formatting
      });
      if (activeSubmissionRunRef.current !== runId) {
        return;
      }
      setSubmissionProgress({ current: 2, total: 4, label: 'Preparing Google Doc download' });

      const pdfArtifact = await createSolutionArtifact({
        extension: 'pdf',
        content: draft.content,
        formatting: draft.formatting
      });
      if (activeSubmissionRunRef.current !== runId) {
        return;
      }
      setSubmissionProgress({ current: 3, total: 4, label: 'Finalising PDF export' });

      submissionUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      submissionUrlsRef.current = [];

      const docxUrl = URL.createObjectURL(docxArtifact.blob);
      const pdfUrl = URL.createObjectURL(pdfArtifact.blob);
      submissionUrlsRef.current.push(docxUrl, pdfUrl);

      setSubmissionArtifacts([
        {
          kind: 'google-doc',
          url: docxUrl,
          fileName: `Completed_${baseName}_${stamp}.docx`,
          mimeType: docxArtifact.mimeType
        },
        {
          kind: 'pdf',
          url: pdfUrl,
          fileName: `Completed_${baseName}_${stamp}.pdf`,
          mimeType: pdfArtifact.mimeType
        }
      ]);
      setSubmissionProgress({ current: 4, total: 4, label: 'Ready for download' });
      setSubmissionStatus('ready');
    } catch (err) {
      if (activeSubmissionRunRef.current === runId) {
        setSubmissionStatus('error');
        setSubmissionError((err as Error).message || 'Failed to generate the completed assignment.');
        setSubmissionProgress(null);
      }
    }
  };

  const handleCancelSubmission = () => {
    if (submissionStatus !== 'working') {
      return;
    }
    activeSubmissionRunRef.current = Date.now();
    setSubmissionStatus('cancelled');
    setSubmissionProgress(null);
  };

  const handleResumeSubmission = () => {
    if (submissionStatus !== 'cancelled') {
      return;
    }
    setSubmissionStatus('idle');
    void handleGenerateSubmission();
  };

  const generateGuide = async () => {
    if (!assignment || !hasGuideContext) {
      return;
    }
    if (guideStatus === 'generating') {
      return;
    }
    const previousPlan = guidePlan;
    try {
      setGuideStatus('generating');
      setGuideError(null);
      const plan = buildStudyGuidePlan({
        assignmentName: assignment.name,
        courseName,
        dueAt: assignment.due_at ?? null,
        contexts: combinedContexts
      });
      const totalSections = plan.sections.length;
      const runId = Date.now();
      activeGuideRunRef.current = runId;
      setGuideProgress({ current: 0, total: totalSections, label: 'Analysing context materials' });
      setGuidePlan({ ...plan, sections: [] });

      for (let index = 0; index < plan.sections.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => window.setTimeout(resolve, 160));
        if (activeGuideRunRef.current !== runId) {
          return;
        }
        const nextSections = plan.sections.slice(0, index + 1);
        setGuidePlan({ ...plan, sections: nextSections });
        setGuideProgress({
          current: index + 1,
          total: totalSections,
          label: `Stitching ${plan.sections[index].title}`
        });
      }

      if (activeGuideRunRef.current !== runId) {
        return;
      }
      setGuideProgress(null);
      setGuideStatus('ready');
    } catch (err) {
      console.error('Failed to generate study guide', err);
      if (previousPlan) {
        setGuidePlan(previousPlan);
      }
      setGuideError((err as Error).message || 'Failed to generate the guide.');
      setGuideProgress(null);
      setGuideStatus('error');
    }
  };

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
      setError('Only PDF or DOCX files are supported.');
      setStatus('error');
      return;
    }

    setProcessing(true);
    setStatus('idle');
    setError(null);

    try {
      const descriptors: Array<{ path: string; name: string; type?: string }> = [];

      for (const file of supported) {
        const withPath = file as File & { path?: string };
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

      const combined = processed.filter((entry) => entry.content.length);
      if (!combined.length) {
        throw new Error('We could not extract readable text from those files.');
      }

      appendAssignmentContext(
        assignment.id,
        combined.map((entry) => ({ ...entry, uploadedAt: Date.now(), source: 'user' as const }))
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
      <AttachmentsCard attachments={attachments} canvasLink={canvasLink} />

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
        <p style={{ margin: 0, fontWeight: 600 }}>Drag & drop PDF or DOCX files</p>
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
          accept=".pdf,.docx"
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
        {instructorLoading ? (
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            Checking Canvas for instructor-provided materials…
          </p>
        ) : null}
        {instructorError ? (
          <div
            style={{
              color: '#b45309',
              background: 'rgba(251, 191, 36, 0.14)',
              padding: '12px 16px',
              borderRadius: 14,
              marginBottom: 12
            }}
          >
            We couldn’t load the instructor context automatically: {instructorError}
          </div>
        ) : null}
        {hasInstructorContext ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Instructor-provided context</div>
            <ContextList entries={instructorContexts} />
          </div>
        ) : null}
        {userContexts.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: hasInstructorContext ? 20 : 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Your uploads</div>
            <ContextList entries={userContexts} />
          </div>
        ) : null}
        {!hasInstructorContext && !userContexts.length && !instructorLoading ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            {/* PHASE 2: Set expectations when no context has been uploaded yet. */}
            No supporting files yet. We will pull in compatible instructor documents automatically and you can upload
            additional notes anytime.
          </p>
        ) : null}
      </div>

      {hasGuideContext ? (
        <div
          style={{
            border: '1px solid var(--surface-border)',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.85)'
          }}
        >
          <button
            type="button"
            onClick={() => setGuideExpanded((prev) => !prev)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: 600 }}>Study Coach Assignment Guide</span>
            <span style={{ color: 'var(--text-secondary)' }}>{guideExpanded ? '▲' : '▼'}</span>
          </button>
          {guideExpanded ? (
            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Generate a personalised walkthrough with our {STUDY_COACH_LABEL}. It uses instructor materials and your uploads
                as context and only runs when requested. No model names are shown—just student-friendly guidance.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    onClick={handleGenerateSubmission}
                    disabled={submissionDisabled}
                    title={instructionsOnly ? 'Needs a solvable prompt.' : undefined}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '10px 22px',
                      background: submissionDisabled ? 'rgba(148, 163, 184, 0.2)' : 'var(--accent)',
                      color: submissionDisabled ? 'var(--text-secondary)' : '#fff',
                      cursor: submissionDisabled ? 'not-allowed' : 'pointer',
                      boxShadow: submissionDisabled ? 'none' : '0 10px 20px rgba(10, 132, 255, 0.25)',
                      fontWeight: 600
                    }}
                  >
                    Generate completed assignment
                  </button>
                  <button
                    type="button"
                    onClick={generateGuide}
                    disabled={!hasGuideContext || guideStatus === 'generating'}
                    style={{
                      border: '1px solid var(--surface-border)',
                      borderRadius: 999,
                      padding: '10px 22px',
                      background: '#fff',
                      color: hasGuideContext && guideStatus !== 'generating' ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor:
                        !hasGuideContext || guideStatus === 'generating' ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Generate guide
                  </button>
                  {classificationChecking ? (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      Checking assignment type…
                    </span>
                  ) : null}
                  {instructionsOnly ? (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      This file contains instructions. You can generate a Study Guide.
                    </span>
                  ) : null}
                </div>
                {classification.status === 'error' && classification.reason ? (
                  <span style={{ color: '#b45309', fontSize: 13 }}>{classification.reason}</span>
                ) : null}
                {submissionStatus === 'working' && submissionProgress ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      alignItems: 'center',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>
                      {submissionProgress.label} ({submissionProgress.current} of {submissionProgress.total})
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelSubmission}
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 999,
                        padding: '6px 16px',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                {submissionStatus === 'cancelled' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      alignItems: 'center',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>Generation paused.</span>
                    <button
                      type="button"
                      onClick={handleResumeSubmission}
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 999,
                        padding: '6px 16px',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Resume
                    </button>
                  </div>
                ) : null}
                {submissionStatus === 'error' && submissionError ? (
                  <div
                    style={{
                      color: '#b91c1c',
                      background: 'rgba(239, 68, 68, 0.12)',
                      padding: '12px 16px',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <span>{submissionError}</span>
                    <button
                      type="button"
                      onClick={handleGenerateSubmission}
                      style={{
                        alignSelf: 'flex-start',
                        border: '1px solid var(--surface-border)',
                        borderRadius: 999,
                        padding: '6px 16px',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {submissionStatus === 'ready' && submissionArtifacts.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {submissionArtifacts.map((artifact) => (
                        <a
                          key={artifact.kind}
                          href={artifact.url}
                          download={artifact.fileName}
                          style={{
                            background: artifact.kind === 'google-doc' ? 'var(--accent)' : '#0f172a',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '10px 22px',
                            textDecoration: 'none',
                            boxShadow: artifact.kind === 'google-doc'
                              ? '0 10px 20px rgba(10, 132, 255, 0.25)'
                              : '0 8px 16px rgba(15, 23, 42, 0.2)'
                          }}
                        >
                          {artifact.kind === 'google-doc' ? 'Download Google Doc (.docx)' : 'Download PDF'}
                        </a>
                      ))}
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {submissionDraft
                        ? `Citation style: ${submissionDraft.citationStyle}. Sections completed: ${submissionDraft.sectionCount.rendered}/${submissionDraft.sectionCount.total}.`
                        : 'Downloads are ready.'}
                    </span>
                  </div>
                ) : null}
                {sourcesMissing ? (
                  <div
                    style={{
                      color: '#b45309',
                      background: 'rgba(251, 191, 36, 0.14)',
                      padding: '12px 16px',
                      borderRadius: 12
                    }}
                  >
                    Provide your sources before exporting to complete the references list.
                  </div>
                ) : null}
                {tokenLimitReached ? (
                  <div
                    style={{
                      color: '#0369a1',
                      background: 'rgba(191, 219, 254, 0.4)',
                      padding: '12px 16px',
                      borderRadius: 12
                    }}
                  >
                    Longer sections were polished first. Upgrade to finish the remaining prompts automatically.
                  </div>
                ) : null}
              </div>
              {hasGuideContext ? (
                <StudyGuidePanel
                  plan={guidePlan}
                  status={guideStatus}
                  progress={guideProgress}
                  onGenerate={generateGuide}
                  canGenerate={hasGuideContext && guideStatus !== 'generating'}
                  error={guideError}
                  showGenerateAction={false}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
