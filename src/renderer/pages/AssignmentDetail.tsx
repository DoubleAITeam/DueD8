import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import { createSubmissionArtifacts } from '../utils/assignmentSolution';
import StudyGuidePanel from '../components/StudyGuidePanel';
import { buildStudyGuidePlan, type StudyGuidePlan } from '../utils/studyGuide';
import { featureFlags } from '../../shared/featureFlags';
import { buildSubmissionDocument } from '../utils/submissionFormatter';
import type { AssignmentDetectionResult } from '../../shared/assignments';

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
  const solutionUrlsRef = useRef<{ docx: string | null; pdf: string | null }>({ docx: null, pdf: null });
  const classificationSignatureRef = useRef<string | null>(null);
  const activeGenerationRef = useRef<number | null>(null);
  const generationCancelledRef = useRef(false);
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
  const [solutionStatus, setSolutionStatus] = useState<'idle' | 'generating' | 'ready' | 'error' | 'cancelled'>('idle');
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionFiles, setSolutionFiles] = useState<
    | {
        docx: { url: string; fileName: string; mimeType: string };
        pdf: { url: string; fileName: string; mimeType: string };
      }
    | null
  >(null);
  const [generationProgress, setGenerationProgress] = useState<
    { label: string; value: number; total: number } | null
  >(null);
  const [generationMetadata, setGenerationMetadata] = useState<
    | {
        missingSources: boolean;
        citationStyle: string;
        upgradeRequired: boolean;
        incompleteSections: string[];
      }
    | null
  >(null);
  const [generationParagraphs, setGenerationParagraphs] = useState<string[] | null>(null);
  const [classificationStatus, setClassificationStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [classificationResult, setClassificationResult] = useState<AssignmentDetectionResult | null>(null);
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
  const instructionsOnly = classificationResult?.kind === 'instructions_only';
  const submissionButtonDisabled =
    solutionStatus === 'generating' || classificationStatus === 'checking' || instructionsOnly;
  const submissionButtonTitle = instructionsOnly
    ? 'Needs a solvable prompt.'
    : classificationStatus === 'checking'
      ? 'Checking assignment type…'
      : undefined;
  const guideButtonDisabled = !hasGuideContext || guideStatus === 'generating';
  const guideButtonTitle = !hasGuideContext
    ? 'Upload instructor files or notes to enable the guide.'
    : undefined;

  useEffect(() => {
    return () => {
      if (solutionUrlsRef.current.docx) {
        URL.revokeObjectURL(solutionUrlsRef.current.docx);
        solutionUrlsRef.current.docx = null;
      }
      if (solutionUrlsRef.current.pdf) {
        URL.revokeObjectURL(solutionUrlsRef.current.pdf);
        solutionUrlsRef.current.pdf = null;
      }
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
    setSolutionStatus('idle');
    setSolutionError(null);
    generationCancelledRef.current = false;
    activeGenerationRef.current = null;
    if (solutionUrlsRef.current.docx) {
      URL.revokeObjectURL(solutionUrlsRef.current.docx);
      solutionUrlsRef.current.docx = null;
    }
    if (solutionUrlsRef.current.pdf) {
      URL.revokeObjectURL(solutionUrlsRef.current.pdf);
      solutionUrlsRef.current.pdf = null;
    }
    setSolutionFiles(null);
    setGenerationProgress(null);
    setGenerationMetadata(null);
    setGenerationParagraphs(null);
    setClassificationStatus('idle');
    setClassificationResult(null);
    classificationSignatureRef.current = null;
    setAttachments([]);
    setCanvasLink(assignment?.html_url ?? null);
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
      setClassificationStatus('idle');
      setClassificationResult(null);
      classificationSignatureRef.current = null;
      return;
    }

    const detectionSource = combinedContexts.length
      ? combinedContexts.map((entry) => entry.content).join('\n\n')
      : assignment.description ?? '';

    const signature = `${assignment.id}::${combinedContexts.length}::${detectionSource.length}`;
    if (classificationSignatureRef.current === signature) {
      return;
    }
    classificationSignatureRef.current = signature;

    if (!detectionSource.trim().length) {
      setClassificationStatus('idle');
      setClassificationResult(null);
      return;
    }

    let cancelled = false;
    setClassificationStatus('checking');
    (async () => {
      try {
        const response = await window.dued8.assignments.classify({
          assignment: { name: assignment.name, description: assignment.description ?? null },
          extractedText: detectionSource
        });
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setClassificationStatus('error');
          setClassificationResult(null);
          return;
        }
        setClassificationResult(response.data);
        setClassificationStatus('idle');
      } catch (err) {
        console.error('Assignment classification failed', err);
        if (!cancelled) {
          setClassificationStatus('error');
          setClassificationResult(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment, combinedContexts]);

  const determineDownloadBase = () => {
    const baseName = safeDownloadName(assignment?.name ?? 'assignment');
    return baseName.length ? baseName : 'assignment';
  };

  const handleGenerateSubmission = async () => {
    if (!assignment) {
      return;
    }
    if (solutionStatus === 'generating') {
      return;
    }
    generationCancelledRef.current = false;
    setSolutionStatus('generating');
    setSolutionError(null);
    if (solutionUrlsRef.current.docx) {
      URL.revokeObjectURL(solutionUrlsRef.current.docx);
      solutionUrlsRef.current.docx = null;
    }
    if (solutionUrlsRef.current.pdf) {
      URL.revokeObjectURL(solutionUrlsRef.current.pdf);
      solutionUrlsRef.current.pdf = null;
    }
    setSolutionFiles(null);
    setGenerationProgress({ label: 'Analysing assignment format', value: 0, total: 3 });
    setGenerationMetadata(null);
    setGenerationParagraphs(null);
    const runId = Date.now();
    activeGenerationRef.current = runId;

    const resolveContexts = () => {
      if (combinedContexts.length) {
        return combinedContexts.map((entry) => ({ fileName: entry.fileName, content: entry.content }));
      }
      const fallbackContent = assignment.description?.trim().length
        ? assignment.description
        : 'Assignment instructions were not provided, so the generator mirrored the syllabus guidelines.';
      return [
        {
          fileName: assignment.name ?? 'assignment',
          content: fallbackContent ?? ''
        }
      ];
    };

    const waitFor = (duration: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), duration);
      });

    try {
      await waitFor(120);
      if (generationCancelledRef.current || activeGenerationRef.current !== runId) {
        throw new Error('cancelled');
      }
      setGenerationProgress({ label: 'Mapping prompt sections', value: 1, total: 3 });

      const document = buildSubmissionDocument({
        assignmentName: assignment.name,
        courseName,
        dueText,
        contexts: resolveContexts(),
        canvasLink,
        attachments: attachments.map((attachment) => ({ name: attachment.name, url: attachment.url }))
      });

      if (generationCancelledRef.current || activeGenerationRef.current !== runId) {
        throw new Error('cancelled');
      }

      setGenerationProgress({ label: 'Formatting exports', value: 2, total: 3 });

      const artifacts = await createSubmissionArtifacts(document);

      if (generationCancelledRef.current || activeGenerationRef.current !== runId) {
        throw new Error('cancelled');
      }

      const base = determineDownloadBase();
      const docxName = base.endsWith('.docx') ? base : `${base}.docx`;
      const pdfName = base.endsWith('.pdf') ? base : `${base}.pdf`;
      const docxDownload = docxName.startsWith('Completed_') ? docxName : `Completed_${docxName}`;
      const pdfDownload = pdfName.startsWith('Completed_') ? pdfName : `Completed_${pdfName}`;

      if (solutionUrlsRef.current.docx) {
        URL.revokeObjectURL(solutionUrlsRef.current.docx);
      }
      if (solutionUrlsRef.current.pdf) {
        URL.revokeObjectURL(solutionUrlsRef.current.pdf);
      }

      const docxUrl = URL.createObjectURL(artifacts.docx.blob);
      const pdfUrl = URL.createObjectURL(artifacts.pdf.blob);
      solutionUrlsRef.current.docx = docxUrl;
      solutionUrlsRef.current.pdf = pdfUrl;

      setSolutionFiles({
        docx: { url: docxUrl, fileName: docxDownload, mimeType: artifacts.docx.mimeType },
        pdf: { url: pdfUrl, fileName: pdfDownload, mimeType: artifacts.pdf.mimeType }
      });

      setGenerationMetadata({
        missingSources: document.missingSources,
        citationStyle: document.citationStyle,
        upgradeRequired: document.upgradeRequired,
        incompleteSections: document.incompleteSections
      });
      setGenerationParagraphs(artifacts.paragraphs);
      setGenerationProgress(null);
      setSolutionStatus('ready');
      activeGenerationRef.current = null;
    } catch (err) {
      activeGenerationRef.current = null;
      if ((err as Error).message === 'cancelled') {
        setSolutionStatus('cancelled');
        setGenerationProgress(null);
        return;
      }
      console.error('Failed to generate submission', err);
      setSolutionStatus('error');
      setSolutionError((err as Error).message || 'Failed to generate the completed assignment.');
      setGenerationProgress(null);
    }
  };

  const cancelGeneration = () => {
    if (solutionStatus !== 'generating') {
      return;
    }
    generationCancelledRef.current = true;
    setGenerationProgress(null);
    setSolutionStatus('cancelled');
  };

  const resumeGeneration = () => {
    if (!assignment) {
      return;
    }
    generationCancelledRef.current = false;
    setSolutionStatus('idle');
    setSolutionError(null);
    handleGenerateSubmission();
  };

  const generateGuide = async () => {
    if (!assignment || !hasGuideContext) {
      return;
    }
    if (guideStatus === 'generating') {
      return;
    }
    setGuideExpanded(true);
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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12
        }}
      >
        <button
          type="button"
          onClick={handleGenerateSubmission}
          disabled={submissionButtonDisabled}
          title={submissionButtonTitle}
          style={{
            borderRadius: 999,
            padding: '10px 22px',
            border: 'none',
            background: submissionButtonDisabled ? 'rgba(148,163,184,0.25)' : 'var(--accent)',
            color: submissionButtonDisabled ? 'var(--text-secondary)' : '#fff',
            cursor: submissionButtonDisabled ? 'not-allowed' : 'pointer',
            boxShadow: submissionButtonDisabled ? 'none' : '0 10px 20px rgba(10, 132, 255, 0.25)',
            fontWeight: 600
          }}
        >
          Generate completed assignment
        </button>
        <button
          type="button"
          onClick={generateGuide}
          disabled={guideButtonDisabled}
          title={guideButtonTitle}
          style={{
            borderRadius: 999,
            padding: '10px 22px',
            border: '1px solid var(--surface-border)',
            background: guideButtonDisabled ? 'rgba(148,163,184,0.15)' : '#fff',
            color: guideButtonDisabled ? 'var(--text-secondary)' : 'var(--accent)',
            cursor: guideButtonDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 600
          }}
        >
          Generate guide
        </button>
        {classificationStatus === 'checking' ? (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Checking assignment type…
          </span>
        ) : null}
        {instructionsOnly ? (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            This file contains instructions. You can generate a Study Guide.
          </span>
        ) : null}
        {classificationStatus === 'error' ? (
          <span style={{ color: '#b45309', fontSize: 13 }}>
            We couldn’t verify the assignment type. Try again.
          </span>
        ) : null}
      </div>

      {solutionStatus === 'generating' && generationProgress ? (
        <div
          style={{
            marginTop: -4,
            border: '1px solid var(--surface-border)',
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(10,132,255,0.08)'
          }}
        >
          <span style={{ fontWeight: 600 }}>{generationProgress.label}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Step {generationProgress.value + 1} of {generationProgress.total}
          </span>
          <button
            type="button"
            onClick={cancelGeneration}
            style={{
              borderRadius: 999,
              border: '1px solid var(--surface-border)',
              background: '#fff',
              padding: '6px 14px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {solutionStatus === 'cancelled' ? (
        <div
          style={{
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(191,219,254,0.4)'
          }}
        >
          <span>Generation paused. Resume when you’re ready.</span>
          <button
            type="button"
            onClick={resumeGeneration}
            style={{
              borderRadius: 999,
              border: '1px solid var(--surface-border)',
              background: '#fff',
              padding: '6px 16px',
              cursor: 'pointer'
            }}
          >
            Resume
          </button>
        </div>
      ) : null}

      {solutionStatus === 'error' && solutionError ? (
        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(239,68,68,0.5)',
            background: 'rgba(254,226,226,0.6)',
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center'
          }}
        >
          <span style={{ color: '#991b1b' }}>{solutionError}</span>
          <button
            type="button"
            onClick={handleGenerateSubmission}
            style={{
              borderRadius: 999,
              border: '1px solid var(--surface-border)',
              background: '#fff',
              padding: '6px 14px',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {solutionStatus === 'ready' && solutionFiles ? (
        <div
          style={{
            border: '1px solid var(--surface-border)',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'rgba(255,255,255,0.88)'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <a
              href={solutionFiles.docx.url}
              download={solutionFiles.docx.fileName}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 999,
                padding: '10px 22px',
                textDecoration: 'none',
                boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)'
              }}
            >
              Download Google Doc (DOCX)
            </a>
            <a
              href={solutionFiles.pdf.url}
              download={solutionFiles.pdf.fileName}
              style={{
                borderRadius: 999,
                padding: '10px 22px',
                border: '1px solid var(--surface-border)',
                textDecoration: 'none',
                color: 'var(--accent)'
              }}
            >
              Download PDF
            </a>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Submission formatted in {generationMetadata?.citationStyle ?? 'APA 7'} with Times New Roman styling.
          </span>
          {generationMetadata?.missingSources ? (
            <div
              style={{
                borderRadius: 12,
                background: 'rgba(251,191,36,0.18)',
                border: '1px solid rgba(217,119,6,0.4)',
                padding: '10px 14px',
                color: '#b45309'
              }}
            >
              This submission still needs your sources before export. Replace the [SOURCE NEEDED] entries in the reference list.
            </div>
          ) : null}
          {generationMetadata?.upgradeRequired ? (
            <div
              style={{
                borderRadius: 12,
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(37,99,235,0.3)',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              <strong>Upgrade to finish the remaining sections.</strong>
              {(generationMetadata?.incompleteSections?.length ?? 0) ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
                  {generationMetadata?.incompleteSections?.slice(0, 3).map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                  {generationMetadata && generationMetadata.incompleteSections.length > 3 ? <li>…</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}
          {generationParagraphs ? (
            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {generationParagraphs.slice(0, 3).map((paragraph, index) => (
                  <p key={index} style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
              <StudyGuidePanel
                plan={guidePlan}
                status={guideStatus}
                progress={guideProgress}
                onGenerate={generateGuide}
                canGenerate={hasGuideContext}
                error={guideError}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
