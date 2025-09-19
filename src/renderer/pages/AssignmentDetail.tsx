import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import {
  buildSolutionContent,
  createSolutionArtifact,
  type GeneratedSubmission
} from '../utils/assignmentSolution';
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
  const artifactUrlsRef = useRef<string[]>([]);
  const generationControllerRef = useRef<{ cancelled: boolean } | null>(null);
  const classificationRunRef = useRef(0);
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
  const activeGuideRunRef = useRef<number>(0);
  const [submissionStatus, setSubmissionStatus] = useState<
    'idle' | 'generating' | 'ready' | 'error' | 'cancelled'
  >('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionArtifacts, setSubmissionArtifacts] = useState<
    Array<{ kind: 'docx' | 'pdf'; url: string; fileName: string; mimeType: string }>
  >([]);
  const [submissionProgress, setSubmissionProgress] = useState<
    { current: number; total: number; label: string } | null
  >(null);
  const [submissionSummary, setSubmissionSummary] = useState<GeneratedSubmission | null>(null);
  const [needsSources, setNeedsSources] = useState(false);
  const [upgradeGate, setUpgradeGate] = useState<{ completed: number; total: number } | null>(null);
  const [classification, setClassification] = useState<{
    status: 'idle' | 'loading' | 'solvable_assignment' | 'instructions_only' | 'error';
    confidence?: number;
    reason?: string;
  }>({ status: assignment ? 'loading' : 'idle' });
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentLink[]>([]);
  const [canvasLink, setCanvasLink] = useState<string | null>(assignment?.html_url ?? null);

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
  const contextSignature = useMemo(
    () =>
      combinedContexts
        .map((entry) => `${entry.fileName}::${entry.uploadedAt}::${entry.content.length}`)
        .join('|'),
    [combinedContexts]
  );
  const classificationStatus = classification.status;
  const instructionsOnly = classificationStatus === 'instructions_only';
  const classificationLoading = classificationStatus === 'loading';
  const submissionButtonDisabled =
    !hasGuideContext || instructionsOnly || classificationLoading || submissionStatus === 'generating';
  let submissionButtonTitle: string | undefined;
  if (instructionsOnly) {
    submissionButtonTitle = 'Needs a solvable prompt.';
  } else if (!hasGuideContext) {
    submissionButtonTitle = 'Add assignment context to generate the submission.';
  } else if (classificationLoading) {
    submissionButtonTitle = 'Analysing assignment…';
  }
  const guideButtonDisabled = !hasGuideContext || guideStatus === 'generating';
  const guideButtonTitle = !hasGuideContext ? 'Add assignment context to generate a guide.' : undefined;

  const releaseSubmissionArtifacts = () => {
    if (artifactUrlsRef.current.length) {
      artifactUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (revokeError) {
          console.warn('Failed to revoke artifact URL', revokeError);
        }
      });
      artifactUrlsRef.current = [];
    }
    setSubmissionArtifacts([]);
  };

  useEffect(() => {
    return () => {
      if (generationControllerRef.current) {
        generationControllerRef.current.cancelled = true;
      }
      releaseSubmissionArtifacts();
    };
  }, []);

  useEffect(() => {
    if (generationControllerRef.current) {
      generationControllerRef.current.cancelled = true;
      generationControllerRef.current = null;
    }
    releaseSubmissionArtifacts();
    setInstructorError(null);
    setInstructorLoading(false);
    setGuideStatus('idle');
    setGuidePlan(null);
    setGuideProgress(null);
    setGuideError(null);
    activeGuideRunRef.current += 1;
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionProgress(null);
    setSubmissionSummary(null);
    setNeedsSources(false);
    setUpgradeGate(null);
    setAttachments([]);
    setCanvasLink(assignment?.html_url ?? null);
    setClassification(assignment ? { status: 'loading' } : { status: 'idle' });
    setClassificationError(null);
    setGuideExpanded(false);
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
    if (!hasGuideContext) {
      setGuideExpanded(false);
    }
  }, [hasGuideContext]);

  useEffect(() => {
    if (!assignment) {
      setClassification({ status: 'idle' });
      setClassificationError(null);
      return;
    }

    const runId = classificationRunRef.current + 1;
    classificationRunRef.current = runId;
    const assignmentPayload =
      assignment.name || assignment.description
        ? { name: assignment.name ?? null, description: assignment.description ?? null }
        : null;
    const extractedText = [
      typeof assignment.description === 'string' ? assignment.description : '',
      ...combinedContexts.map((entry) => entry.content)
    ]
      .filter((segment) => segment && segment.trim().length)
      .join('\n\n')
      .slice(0, 30000);

    if (!assignmentPayload && !extractedText.trim().length) {
      setClassification({ status: 'solvable_assignment' });
      setClassificationError(null);
      return;
    }

    setClassification({ status: 'loading' });
    setClassificationError(null);
    let cancelled = false;

    (async () => {
      try {
        const response = await window.dued8.assignments.classify({
          assignment: assignmentPayload,
          extractedText
        });
        if (cancelled || classificationRunRef.current !== runId) {
          return;
        }
        if (!response.ok) {
          setClassification({ status: 'error' });
          setClassificationError(response.error);
          return;
        }
        setClassification({
          status: response.data.classification,
          confidence: response.data.confidence,
          reason: response.data.reason
        });
        setClassificationError(null);
      } catch (err) {
        console.error('Assignment classification failed', err);
        if (!cancelled && classificationRunRef.current === runId) {
          setClassification({ status: 'error' });
          setClassificationError((err as Error).message || 'Classification failed.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment, combinedContexts, contextSignature]);

  useEffect(() => {
    if (!assignment) {
      return;
    }
    releaseSubmissionArtifacts();
    setSubmissionStatus('idle');
    setSubmissionError(null);
    setSubmissionProgress(null);
    setSubmissionSummary(null);
    setNeedsSources(false);
    setUpgradeGate(null);
  }, [assignment?.id, contextSignature]);

  const cancelSubmissionGeneration = () => {
    if (submissionStatus !== 'generating') {
      return;
    }
    if (generationControllerRef.current) {
      generationControllerRef.current.cancelled = true;
      generationControllerRef.current = null;
    }
    setSubmissionStatus('cancelled');
    setSubmissionProgress(null);
  };

  const handleGenerateSubmission = async () => {
    if (!assignment || !hasGuideContext) {
      return;
    }
    if (submissionStatus === 'generating') {
      return;
    }

    const controller = { cancelled: false };
    generationControllerRef.current = controller;
    setSubmissionStatus('generating');
    setSubmissionError(null);
    setSubmissionProgress({ current: 0, total: 4, label: 'Analysing assignment structure' });
    setNeedsSources(false);
    setUpgradeGate(null);

    const checkCancelled = () => {
      if (controller.cancelled) {
        setSubmissionStatus('cancelled');
        setSubmissionProgress(null);
        if (generationControllerRef.current === controller) {
          generationControllerRef.current = null;
        }
        return true;
      }
      return false;
    };

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 160));
      if (checkCancelled()) {
        return;
      }

      setSubmissionProgress({ current: 1, total: 4, label: 'Outlining submission blueprint' });

      const summary = buildSolutionContent({
        assignmentName: assignment.name,
        courseName,
        dueText,
        contexts: combinedContexts.map((entry) => ({
          fileName: entry.fileName,
          content: entry.content
        })),
        canvasLink,
        attachments: attachments.map((attachment) => ({ name: attachment.name, url: attachment.url }))
      });

      if (checkCancelled()) {
        return;
      }

      setSubmissionSummary(summary);
      setNeedsSources(summary.needsSources);
      setUpgradeGate(summary.upgradeGate);
      setSubmissionProgress({ current: 2, total: 4, label: 'Applying course styling' });

      const docxArtifact = await createSolutionArtifact({
        extension: 'docx',
        content: summary.plainText,
        formatting: summary.formatting
      });

      if (checkCancelled()) {
        return;
      }

      setSubmissionProgress({ current: 3, total: 4, label: 'Preparing PDF export' });

      const pdfArtifact = await createSolutionArtifact({
        extension: 'pdf',
        content: summary.plainText,
        formatting: summary.formatting
      });

      if (checkCancelled()) {
        return;
      }

      const baseName = safeDownloadName(`${assignment.name ?? 'assignment'}_${summary.deliverableType}`) || 'assignment';
      const docxName = baseName.endsWith('.docx') ? baseName : `${baseName}.docx`;
      const pdfName = baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`;
      const docxUrl = URL.createObjectURL(docxArtifact.blob);
      const pdfUrl = URL.createObjectURL(pdfArtifact.blob);
      releaseSubmissionArtifacts();
      artifactUrlsRef.current = [docxUrl, pdfUrl];
      setSubmissionArtifacts([
        {
          kind: 'docx',
          url: docxUrl,
          fileName: docxName.startsWith('Completed_') ? docxName : `Completed_${docxName}`,
          mimeType: docxArtifact.mimeType
        },
        {
          kind: 'pdf',
          url: pdfUrl,
          fileName: pdfName.startsWith('Completed_') ? pdfName : `Completed_${pdfName}`,
          mimeType: pdfArtifact.mimeType
        }
      ]);

      setSubmissionProgress({ current: 4, total: 4, label: 'Ready to download' });
      setSubmissionStatus('ready');
      setTimeout(() => {
        setSubmissionProgress(null);
      }, 800);
    } catch (err) {
      if (!controller.cancelled) {
        console.error('Submission generation failed', err);
        setSubmissionStatus('error');
        setSubmissionError((err as Error).message || 'Failed to generate the completed assignment.');
        setSubmissionProgress(null);
      }
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
      }
    }
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
        style={{
          border: '1px solid var(--surface-border)',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.9)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleGenerateSubmission}
            disabled={submissionButtonDisabled}
            title={submissionButtonDisabled ? submissionButtonTitle : undefined}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 20px',
              background: submissionButtonDisabled ? 'rgba(148, 163, 184, 0.3)' : 'var(--accent)',
              color: submissionButtonDisabled ? 'var(--text-secondary)' : '#fff',
              cursor: submissionButtonDisabled ? 'not-allowed' : 'pointer',
              boxShadow: submissionStatus === 'generating' ? 'none' : '0 10px 20px rgba(10, 132, 255, 0.25)',
              fontWeight: 600
            }}
          >
            {submissionStatus === 'generating' ? 'Generating…' : 'Generate completed assignment'}
          </button>
          <button
            type="button"
            onClick={generateGuide}
            disabled={guideButtonDisabled}
            title={guideButtonDisabled ? guideButtonTitle : undefined}
            style={{
              border: '1px solid var(--surface-border)',
              borderRadius: 999,
              padding: '10px 20px',
              background: '#fff',
              color: guideButtonDisabled ? 'var(--text-secondary)' : 'var(--accent)',
              cursor: guideButtonDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {guideStatus === 'generating' ? 'Generating guide…' : 'Generate guide'}
          </button>
          {instructionsOnly ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              This file contains instructions. You can generate a Study Guide.
            </span>
          ) : null}
        </div>
        {classificationLoading ? (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Analysing assignment…</span>
        ) : null}
        {classification.status === 'error' && classificationError ? (
          <span style={{ color: '#b45309', fontSize: 13 }}>Detection unavailable: {classificationError}</span>
        ) : null}
        {submissionProgress && submissionStatus === 'generating' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{submissionProgress.label}</span>
            <progress value={submissionProgress.current} max={submissionProgress.total} />
            <div>
              <button
                type="button"
                onClick={cancelSubmissionGeneration}
                style={{
                  border: '1px solid var(--surface-border)',
                  borderRadius: 999,
                  padding: '6px 16px',
                  background: '#fff',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {submissionStatus === 'cancelled' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span>Generation paused.</span>
            <button
              type="button"
              onClick={handleGenerateSubmission}
              style={{
                border: '1px solid var(--surface-border)',
                borderRadius: 999,
                padding: '6px 16px',
                background: '#fff',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Resume
            </button>
          </div>
        ) : null}
        {submissionError ? (
          <div style={{ color: '#b91c1c', background: 'rgba(239,68,68,0.12)', padding: '10px 14px', borderRadius: 12 }}>
            {submissionError}
          </div>
        ) : null}
        {needsSources ? (
          <div style={{ color: '#b45309', background: 'rgba(253,230,138,0.35)', padding: '10px 14px', borderRadius: 12 }}>
            Add your citation sources before exporting to keep references accurate.
          </div>
        ) : null}
        {upgradeGate ? (
          <div style={{ color: '#1d4ed8', background: 'rgba(191,219,254,0.45)', padding: '10px 14px', borderRadius: 12 }}>
            Generated the first {upgradeGate.completed} of {upgradeGate.total} prompts. Upgrade to finish the remainder.
          </div>
        ) : null}
        {submissionStatus === 'ready' && submissionArtifacts.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {submissionArtifacts.map((artifact) => (
                <a
                  key={artifact.kind}
                  href={artifact.url}
                  download={artifact.fileName}
                  style={{
                    background: artifact.kind === 'docx' ? 'var(--accent)' : '#1f2937',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '10px 20px',
                    textDecoration: 'none',
                    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  {artifact.kind === 'docx' ? 'Download Google Doc (.docx)' : 'Download PDF'}
                </a>
              ))}
            </div>
            {submissionSummary ? (
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Citation style: {submissionSummary.citationStyle}
              </span>
            ) : null}
          </div>
        ) : null}
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
                Generate a personalised walkthrough with our {STUDY_COACH_LABEL}. It blends instructor materials and your
                uploads without exposing system prompts.
              </p>
              <StudyGuidePanel
                plan={guidePlan}
                status={guideStatus}
                progress={guideProgress}
                onGenerate={generateGuide}
                canGenerate={!guideButtonDisabled}
                error={guideError}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
