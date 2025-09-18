import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import { buildSolutionContent, createSolutionArtifact } from '../utils/assignmentSolution';

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt'];
const STUDY_COACH_LABEL = 'Study Coach';

type GuideContent = {
  explanation: string;
  solution: string;
  reasoning: string;
  variations?: string;
  extraExplanation?: string;
  lastUpdated: number;
};

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

function summariseForGuide(entries: AssignmentContextEntry[], limit = 4) {
  if (!entries.length) {
    return '• No uploaded documents detected yet. Focus on the assignment description and rubric.';
  }
  return entries
    .slice(0, limit)
    .map((entry) => {
      const snippet = entry.content.replace(/\s+/g, ' ').trim();
      const preview = snippet.length > 160 ? `${snippet.slice(0, 160)}…` : snippet;
      return `• ${entry.fileName}: ${preview}`;
    })
    .join('\n');
}

function buildReasoningTrace(entries: AssignmentContextEntry[]) {
  const first = entries[0];
  const second = entries[1];
  const steps: string[] = [
    '1. Parse the instructor instructions to understand deliverables and evaluation criteria.',
    first
      ? `2. Highlight key points from “${first.fileName}” to anchor the response in course expectations.`
      : '2. Outline main requirements from the assignment description.',
    second
      ? `3. Cross-reference supporting evidence from “${second.fileName}” to justify the draft.`
      : '3. Draft a structured response that covers each required component before polishing.'
  ];
  return steps.join('\n');
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
  const solutionUrlRef = useRef<string | null>(null);
  const lastContextSignatureRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [instructorError, setInstructorError] = useState<string | null>(null);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [guideStatus, setGuideStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [guideContent, setGuideContent] = useState<GuideContent | null>(null);
  const [solutionStatus, setSolutionStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionFile, setSolutionFile] = useState<
    { url: string; fileName: string; mimeType: string } | null
  >(null);

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

  useEffect(() => {
    return () => {
      if (solutionUrlRef.current) {
        URL.revokeObjectURL(solutionUrlRef.current);
        solutionUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setInstructorError(null);
    setInstructorLoading(false);
    setGuideContent(null);
    setGuideStatus('idle');
    setSolutionStatus('idle');
    setSolutionError(null);
    if (solutionUrlRef.current) {
      URL.revokeObjectURL(solutionUrlRef.current);
      solutionUrlRef.current = null;
    }
    setSolutionFile(null);
    lastContextSignatureRef.current = null;
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
          return;
        }
        const entries = response.data.entries ?? [];
        if (entries.length) {
          appendAssignmentContext(
            assignment.id,
            entries.map((entry) => ({ ...entry, source: 'instructor' as const }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setInstructorError((err as Error).message);
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
    if (!assignment || !hasGuideContext) {
      if (solutionUrlRef.current) {
        URL.revokeObjectURL(solutionUrlRef.current);
        solutionUrlRef.current = null;
      }
      setSolutionStatus('idle');
      setSolutionError(null);
      setSolutionFile(null);
      lastContextSignatureRef.current = null;
      setGuideContent(null);
      setGuideStatus('idle');
      return;
    }

    const signature = combinedContexts
      .map((entry) => `${entry.fileName}::${entry.uploadedAt}::${entry.content.length}`)
      .join('|');

    if (!signature.length) {
      return;
    }

    if (lastContextSignatureRef.current === signature) {
      if (
        solutionStatus === 'ready' ||
        solutionStatus === 'generating' ||
        solutionStatus === 'error'
      ) {
        return;
      }
    }

    let cancelled = false;
    setSolutionStatus('generating');
    setSolutionError(null);
    if (lastContextSignatureRef.current !== signature) {
      setGuideContent(null);
      setGuideStatus('idle');
    }
    lastContextSignatureRef.current = signature;

    const determineExtension = () => {
      const searchOrder = [userContexts, instructorContexts, combinedContexts];
      for (const list of searchOrder) {
        for (const entry of list) {
          const ext = entry.fileName.split('.').pop()?.toLowerCase();
          if (ext && SUPPORTED_EXTENSIONS.includes(ext)) {
            return { extension: ext as 'pdf' | 'docx' | 'txt', originalName: entry.fileName };
          }
        }
      }
      const fallbackName = `${assignment.name ?? 'assignment'}.txt`;
      return { extension: 'txt' as const, originalName: fallbackName };
    };

    const { extension, originalName } = determineExtension();

    const generate = async () => {
      try {
        const content = buildSolutionContent({
          assignmentName: assignment.name,
          courseName,
          dueText,
          contexts: combinedContexts.map((entry) => ({
            fileName: entry.fileName,
            content: entry.content
          }))
        });
        const artifact = await createSolutionArtifact({ extension, content });
        if (cancelled) {
          return;
        }
        const sanitizedOriginal = safeDownloadName(
          originalName || `${assignment.name ?? 'assignment'}.${extension}`
        );
        const ensuredBase = sanitizedOriginal.length ? sanitizedOriginal : `assignment.${extension}`;
        const ensuredWithExt = ensuredBase.includes('.') ? ensuredBase : `${ensuredBase}.${extension}`;
        const downloadName = ensuredWithExt.startsWith('Completed_')
          ? ensuredWithExt
          : `Completed_${ensuredWithExt}`;
        const url = URL.createObjectURL(artifact.blob);
        if (solutionUrlRef.current) {
          URL.revokeObjectURL(solutionUrlRef.current);
        }
        solutionUrlRef.current = url;
        setSolutionFile({ url, fileName: downloadName, mimeType: artifact.mimeType });
        setSolutionStatus('ready');
      } catch (err) {
        if (!cancelled) {
          if (solutionUrlRef.current) {
            URL.revokeObjectURL(solutionUrlRef.current);
            solutionUrlRef.current = null;
          }
          setSolutionFile(null);
          setSolutionStatus('error');
          setSolutionError((err as Error).message || 'Failed to generate the completed file.');
        }
      }
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [assignment, combinedContexts, courseName, dueText, hasGuideContext, instructorContexts, solutionStatus, userContexts]);

  const retrySolutionGeneration = () => {
    if (!assignment) {
      return;
    }
    lastContextSignatureRef.current = null;
    setSolutionStatus('idle');
    setSolutionError(null);
  };

  function generateGuide(mode: 'initial' | 'variations' | 'explainMore') {
    if (!assignment) {
      return;
    }
    if (solutionStatus !== 'ready') {
      return;
    }
    if (guideStatus === 'loading') {
      return;
    }
    if (mode !== 'initial' && !guideContent) {
      generateGuide('initial');
      return;
    }
    setGuideStatus('loading');

    window.setTimeout(() => {
      if (mode === 'initial') {
        const contextSummary = summariseForGuide(combinedContexts);
        const dueDescription = assignment.due_at
          ? `It is due ${new Date(assignment.due_at).toLocaleString()}.`
          : 'No official due date is recorded, so plan a personal deadline.';
        const explanation = `${STUDY_COACH_LABEL} summary for ${assignment.name}:

${dueDescription}

Key details from your available context:
${contextSummary}`;

        const solutionPieces = combinedContexts.slice(0, 3).map((entry, index) => {
          const snippet = entry.content.replace(/\s+/g, ' ').trim();
          const preview = snippet.length > 120 ? `${snippet.slice(0, 120)}…` : snippet;
          return `${index + 1}. Reference “${entry.fileName}” to address: ${preview}`;
        });
        if (!solutionPieces.length) {
          solutionPieces.push('1. Outline your thesis or main answer based on the assignment description.');
          solutionPieces.push('2. Support each section with evidence or examples drawn from course materials.');
          solutionPieces.push('3. Close with a reflection or conclusion that echoes the stated requirements.');
        }
        const solution = `Draft solution outline (from our ${STUDY_COACH_LABEL}):
${solutionPieces.join('\n')}`;

        const reasoning = `Reasoning trace (${STUDY_COACH_LABEL}):
${buildReasoningTrace(combinedContexts)}`;

        setGuideContent({
          explanation,
          solution,
          reasoning,
          lastUpdated: Date.now()
        });
      } else if (mode === 'variations') {
        setGuideContent((previous) => {
          if (!previous) {
            return previous;
          }
          const variations = combinedContexts.slice(0, 2).map((entry, index) => {
            const snippet = entry.content.replace(/\s+/g, ' ').trim();
            const preview = snippet.length > 100 ? `${snippet.slice(0, 100)}…` : snippet;
            return `Variation ${String.fromCharCode(65 + index)}: Emphasise insights from “${entry.fileName}” — ${preview}`;
          });
          if (!variations.length) {
            variations.push('Variation A: Present an analytical angle that compares two perspectives from the course.');
            variations.push('Variation B: Reframe the answer as a step-by-step walkthrough for a peer.');
          }
          return {
            ...previous,
            variations: `Alternative takes (${STUDY_COACH_LABEL}):\n${variations.join('\n')}`,
            lastUpdated: Date.now()
          };
        });
      } else if (mode === 'explainMore') {
        setGuideContent((previous) => {
          if (!previous) {
            return previous;
          }
          const detail = combinedContexts.length
            ? `Start by mapping each required deliverable to the most relevant uploaded document (for example, “${combinedContexts[0].fileName}”). Then note evidence, quotes, or data points before writing full paragraphs.`
            : 'Break the assignment into sub-tasks (research, outline, draft, review) and add checkpoints for each to avoid last-minute rushes.';
          return {
            ...previous,
            extraExplanation: `Deeper breakdown (${STUDY_COACH_LABEL}):\n${detail}`,
            lastUpdated: Date.now()
          };
        });
      }
      setGuideStatus('ready');
    }, 280);
  }

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
            background: 'rgba(255,255,255,0.85)',
            overflow: 'hidden'
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
            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Generate a personalised walkthrough with our {STUDY_COACH_LABEL}. It uses instructor materials and your
                uploads as context and only runs when requested.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <strong>Completed assignment file</strong>
                {solutionStatus === 'generating' || solutionStatus === 'idle' ? (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Preparing your completed assignment file…
                  </span>
                ) : null}
                {solutionStatus === 'error' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                      color: '#b91c1c'
                    }}
                  >
                    <span>We couldn’t finalise the completed file.</span>
                    <button
                      type="button"
                      onClick={retrySolutionGeneration}
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 999,
                        padding: '6px 14px',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {solutionStatus === 'ready' && solutionFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <a
                      href={solutionFile.url}
                      download={solutionFile.fileName}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'var(--accent)',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '10px 22px',
                        textDecoration: 'none',
                        boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)'
                      }}
                    >
                      Download {solutionFile.fileName}
                    </a>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      Save the completed file before exploring the deeper guidance below.
                    </span>
                  </div>
                ) : null}
              </div>
              {solutionStatus === 'ready' ? (
                <>
                  {guideStatus === 'idle' ? (
                    <button
                      type="button"
                      onClick={() => generateGuide('initial')}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 999,
                        padding: '10px 22px',
                        cursor: 'pointer',
                        boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)'
                      }}
                    >
                      Generate guide
                    </button>
                  ) : null}
                  {guideStatus === 'loading' ? (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Our {STUDY_COACH_LABEL} is assembling insights…
                    </div>
                  ) : null}
                  {guideContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <strong>Requirements recap</strong>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                            fontFamily: 'inherit',
                            background: 'rgba(15, 23, 42, 0.04)',
                            padding: '12px 16px',
                            borderRadius: 12
                          }}
                        >
                          {guideContent.explanation}
                        </pre>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <strong>Draft solution</strong>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                            fontFamily: 'inherit',
                            background: 'rgba(15, 23, 42, 0.04)',
                            padding: '12px 16px',
                            borderRadius: 12
                          }}
                        >
                          {guideContent.solution}
                        </pre>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <strong>Reasoning trace</strong>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                            fontFamily: 'inherit',
                            background: 'rgba(15, 23, 42, 0.04)',
                            padding: '12px 16px',
                            borderRadius: 12
                          }}
                        >
                          {guideContent.reasoning}
                        </pre>
                      </div>
                      {guideContent.variations ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <strong>Practice variations</strong>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                              fontFamily: 'inherit',
                              background: 'rgba(15, 23, 42, 0.04)',
                              padding: '12px 16px',
                              borderRadius: 12
                            }}
                          >
                            {guideContent.variations}
                          </pre>
                        </div>
                      ) : null}
                      {guideContent.extraExplanation ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <strong>Deeper explanation</strong>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                              fontFamily: 'inherit',
                              background: 'rgba(15, 23, 42, 0.04)',
                              padding: '12px 16px',
                              borderRadius: 12
                            }}
                          >
                            {guideContent.extraExplanation}
                          </pre>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => generateGuide('variations')}
                          disabled={guideStatus === 'loading'}
                          style={{
                            border: '1px solid var(--surface-border)',
                            borderRadius: 999,
                            padding: '8px 16px',
                            background: '#fff',
                            cursor: guideStatus === 'loading' ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Generate Variations
                        </button>
                        <button
                          type="button"
                          onClick={() => generateGuide('explainMore')}
                          disabled={guideStatus === 'loading'}
                          style={{
                            border: '1px solid var(--surface-border)',
                            borderRadius: 999,
                            padding: '8px 16px',
                            background: '#fff',
                            cursor: guideStatus === 'loading' ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Explain More
                        </button>
                        <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                          Updated {new Date(guideContent.lastUpdated).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
