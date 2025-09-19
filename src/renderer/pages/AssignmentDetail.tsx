import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import {
  buildSolutionContent,
  buildSolutionHtml,
  estimateTokens,
  splitIntoParagraphs,
  truncateToTokenLimit
} from '../utils/assignmentSolution';
import StudyGuidePanel from '../components/StudyGuidePanel';
import { buildStudyGuidePlan, type StudyGuidePlan } from '../utils/studyGuide';
import { featureFlags } from '../../shared/featureFlags';
import { isActualAssignment } from '../../shared/assignments';
import { TOKEN_USER_FALLBACK } from '../../config/tokens';
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

function slugifyAssignment(name: string | undefined | null, id?: number) {
  const base = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (base.length) {
    return base;
  }
  return id ? `assignment-${id}` : 'assignment';
}

type Props = {
  assignment: Assignment | null;
  courseName?: string;
  courseCode?: string;
  onBack: () => void;
  backLabel?: string;
};

export default function AssignmentDetail({ assignment, courseName, courseCode, onBack, backLabel }: Props) {
  const appendAssignmentContext = useStore((s) => s.appendAssignmentContext);
  const assignmentContexts = useStore((s) =>
    assignment ? s.assignmentContexts[assignment.id] ?? [] : []
  );
  const setToast = useStore((s) => s.setToast);
  const profile = useStore((s) => s.profile);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastContextSignatureRef = useRef<string | null>(null);
  const guardSignatureRef = useRef<string | null>(null);
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
  const [solutionStatus, setSolutionStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionContent, setSolutionContent] = useState<string | null>(null);
  const [solutionTokensUsed, setSolutionTokensUsed] = useState(0);
  const [solutionLimitInfo, setSolutionLimitInfo] = useState<
    { estimatedRemaining: number; remainingAssignment: number; remainingDaily: number } | null
  >(null);
  const [attachments, setAttachments] = useState<AttachmentLink[]>([]);
  const [canvasLink, setCanvasLink] = useState<string | null>(assignment?.html_url ?? null);
  const guardEnabled = featureFlags.assignmentSolveGuard;
  const exportsEnabled = featureFlags.solveExports;
  const tokenGatingEnabled = featureFlags.tokenGating;
  const [solveCheck, setSolveCheck] = useState<
    { status: 'idle' | 'checking' | 'allowed' | 'blocked'; reason?: string; confidence?: number }
  >({ status: guardEnabled ? 'checking' : 'allowed' });
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [creatingGoogleDoc, setCreatingGoogleDoc] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const dueText = useMemo(() => {
    if (!assignment?.due_at) {
      return 'No due date provided – double-check in Canvas.';
    }
    return new Date(assignment.due_at).toLocaleString();
  }, [assignment]);

  const assignmentSlug = useMemo(
    () => slugifyAssignment(assignment?.name, assignment?.id),
    [assignment?.name, assignment?.id]
  );

  const solutionParagraphs = useMemo(
    () => (solutionContent ? splitIntoParagraphs(solutionContent) : []),
    [solutionContent]
  );

  const userIdentifier = useMemo(() => {
    const email = profile?.primary_email?.trim();
    return email && email.length ? email : TOKEN_USER_FALLBACK;
  }, [profile?.primary_email]);

  const solutionTitle = useMemo(() => {
    const base = assignment?.name?.trim();
    return base && base.length ? `${base} – Completed Submission` : 'Completed Submission';
  }, [assignment?.name]);

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
  const guardChecking = guardEnabled && solveCheck.status === 'checking';
  const solveGuardBlocked = guardEnabled && solveCheck.status === 'blocked';
  const solveButtonDisabled = !hasGuideContext || guardChecking || solveGuardBlocked;

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
    setSolutionContent(null);
    setSolutionTokensUsed(0);
    setSolutionLimitInfo(null);
    setGoogleError(null);
    lastContextSignatureRef.current = null;
    setAttachments([]);
    setCanvasLink(assignment?.html_url ?? null);
    setSolveCheck({ status: guardEnabled ? 'checking' : 'allowed' });
    setGoogleDocUrl(null);
  }, [assignment?.id]);

  useEffect(() => {
    if (!hasGuideContext) {
      setGuideExpanded(false);
    }
  }, [hasGuideContext]);

  useEffect(() => {
    if (!exportsEnabled) {
      setGoogleConnected(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await window.dued8.google.isConnected();
        if (!cancelled && response.ok) {
          setGoogleConnected(Boolean(response.data?.connected));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to determine Google connection', err);
          setGoogleConnected(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exportsEnabled]);

  useEffect(() => {
    if (!exportsEnabled || !assignment) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await window.dued8.google.getAssignmentDoc({ canvasId: assignment.id });
        if (!cancelled && response.ok) {
          setGoogleDocUrl(response.data.documentUrl ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load assignment Google Doc link', err);
          setGoogleDocUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignment?.id, exportsEnabled]);

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
    if (!guardEnabled) {
      if (solveCheck.status !== 'allowed') {
        setSolveCheck({ status: 'allowed' });
      }
      guardSignatureRef.current = null;
      return;
    }
    if (!assignment) {
      setSolveCheck({ status: 'idle' });
      guardSignatureRef.current = null;
      return;
    }

    const signature = combinedContexts
      .map((entry) => `${entry.fileName}::${entry.uploadedAt}::${entry.content.length}`)
      .join('|');
    const combinedText = combinedContexts.map((entry) => entry.content).join('\n\n');

    if (!combinedText.trim().length) {
      guardSignatureRef.current = signature.length ? signature : null;
      setSolveCheck({ status: 'allowed', confidence: 0.5 });
      return;
    }

    if (
      guardSignatureRef.current === signature &&
      (solveCheck.status === 'allowed' || solveCheck.status === 'blocked')
    ) {
      return;
    }

    guardSignatureRef.current = signature;
    let cancelled = false;
    setSolveCheck({ status: 'checking' });

    (async () => {
      try {
        const result = await isActualAssignment(assignment, combinedText);
        if (cancelled) {
          return;
        }
        if (result.isAssignment) {
          setSolveCheck({ status: 'allowed', confidence: result.confidence, reason: result.reason });
        } else {
          setSolveCheck({ status: 'blocked', confidence: result.confidence, reason: result.reason });
          setSolutionContent(null);
          setSolutionTokensUsed(0);
          setSolutionLimitInfo(null);
          setSolutionStatus('idle');
        }
      } catch (err) {
        console.error('Assignment guard check failed', err);
        if (!cancelled) {
          setSolveCheck({ status: 'allowed' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment, combinedContexts, guardEnabled, solveCheck.status]);

  useEffect(() => {
    if (!assignment || !hasGuideContext) {
      setSolutionStatus('idle');
      setSolutionError(null);
      setSolutionContent(null);
      setSolutionTokensUsed(0);
      setSolutionLimitInfo(null);
      lastContextSignatureRef.current = null;
      setGuidePlan(null);
      setGuideProgress(null);
      setGuideError(null);
      setGuideStatus('idle');
      activeGuideRunRef.current += 1;
      return;
    }

    if (guardEnabled) {
      if (solveCheck.status === 'checking') {
        return;
      }
      if (solveCheck.status === 'blocked') {
        return;
      }
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
      setGuidePlan(null);
      setGuideProgress(null);
      setGuideError(null);
      setGuideStatus('idle');
      activeGuideRunRef.current += 1;
    }
    lastContextSignatureRef.current = signature;

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
        const totalTokens = estimateTokens(content);
        let finalContent = content;
        let tokensRecorded = totalTokens;
        let limitInfo: { estimatedRemaining: number; remainingAssignment: number; remainingDaily: number } | null = null;

        if (tokenGatingEnabled) {
          const allowanceResponse = await window.dued8.tokens.getAllowance({
            canvasId: assignment.id,
            courseId: assignment.course_id,
            slug: assignmentSlug,
            userId: userIdentifier,
            requestedTokens: totalTokens
          });
          if (!allowanceResponse.ok) {
            throw new Error(allowanceResponse.error || 'Token limit check failed');
          }
          const allowance = allowanceResponse.data;
          const truncated = allowance.limitHit
            ? truncateToTokenLimit(content, allowance.allowedTokens)
            : { text: content, tokensUsed: totalTokens, truncated: false };
          finalContent = truncated.text.trim().length ? truncated.text : '';
          tokensRecorded = truncated.tokensUsed;
          limitInfo = allowance.limitHit
            ? {
                estimatedRemaining: Math.max(totalTokens - truncated.tokensUsed, 0),
                remainingAssignment: allowance.remainingAssignment,
                remainingDaily: allowance.remainingDaily
              }
            : null;
          if (tokensRecorded > 0) {
            const recordResponse = await window.dued8.tokens.recordUsage({
              canvasId: assignment.id,
              courseId: assignment.course_id,
              slug: assignmentSlug,
              userId: userIdentifier,
              tokens: tokensRecorded
            });
            if (!recordResponse.ok) {
              throw new Error(recordResponse.error || 'Failed to record token usage');
            }
          }
        }

        if (cancelled) {
          return;
        }

        setSolutionContent(finalContent);
        setSolutionTokensUsed(tokensRecorded);
        setSolutionLimitInfo(limitInfo);
        setSolutionStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setSolutionContent(null);
          setSolutionTokensUsed(0);
          setSolutionLimitInfo(null);
          setSolutionStatus('error');
          setSolutionError((err as Error).message || 'Failed to generate the completed file.');
        }
      }
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [
    assignment,
    combinedContexts,
    courseName,
    dueText,
    guardEnabled,
    hasGuideContext,
    instructorContexts,
    solutionStatus,
    solveCheck.status,
    userContexts
  ]);

  const retrySolutionGeneration = () => {
    if (!assignment) {
      return;
    }
    if (solveGuardBlocked || guardChecking) {
      return;
    }
    lastContextSignatureRef.current = null;
    setSolutionStatus('idle');
    setSolutionError(null);
    setSolutionContent(null);
    setSolutionTokensUsed(0);
    setSolutionLimitInfo(null);
  };

  const handleCreateGoogleDoc = async () => {
    if (!exportsEnabled || !assignment || !solutionContent || creatingGoogleDoc) {
      return;
    }
    setCreatingGoogleDoc(true);
    setGoogleError(null);
    try {
      const response = await window.dued8.google.createDoc({
        canvasId: assignment.id,
        courseId: assignment.course_id,
        slug: assignmentSlug,
        title: solutionTitle,
        content: solutionContent
      });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to create Google Doc');
      }
      setGoogleDocUrl(response.data.documentUrl);
      setGoogleConnected(true);
      setToast('Google Doc created.');
    } catch (err) {
      console.error('Create Google Doc failed', err);
      const message = (err as Error).message || 'Failed to create Google Doc';
      setGoogleError(message);
      setToast('Unable to create Google Doc. Reconnect Google and try again.');
    } finally {
      setCreatingGoogleDoc(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!exportsEnabled || !assignment || !solutionContent || exportingPdf) {
      return;
    }
    setExportingPdf(true);
    try {
      const html = buildSolutionHtml({ title: solutionTitle, content: solutionContent });
      const response = await window.dued8.solution.exportPdf({
        html,
        courseCode: courseCode ?? 'Course',
        assignmentSlug
      });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to export PDF');
      }
      if (!response.data?.cancelled) {
        setToast('PDF download saved.');
      }
    } catch (err) {
      console.error('PDF export failed', err);
      setToast('Unable to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const generateGuide = async () => {
    if (!assignment || !hasGuideContext) {
      return;
    }
    if (solutionStatus !== 'ready') {
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

      {solveGuardBlocked ? (
        <div
          style={{
            borderRadius: 14,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <strong>This looks like instructions, not a student deliverable. I will not auto-complete this.</strong>
          {solveCheck.reason ? (
            <span style={{ fontSize: 13 }}>{solveCheck.reason}</span>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <strong>Completed assignment file</strong>
                  <button
                    type="button"
                    onClick={retrySolutionGeneration}
                    disabled={solveButtonDisabled}
                    style={{
                      border: '1px solid var(--surface-border)',
                      borderRadius: 999,
                      padding: '6px 18px',
                      background: solveButtonDisabled ? 'rgba(148, 163, 184, 0.2)' : '#fff',
                      color: solveButtonDisabled ? 'var(--text-secondary)' : 'var(--accent)',
                      cursor: solveButtonDisabled ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Solve
                  </button>
                </div>
                {guardChecking ? (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Checking if this is a student deliverable…
                  </span>
                ) : null}
                {!guardChecking &&
                !solveGuardBlocked &&
                (solutionStatus === 'generating' || solutionStatus === 'idle') ? (
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
                      disabled={solveGuardBlocked}
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 999,
                        padding: '6px 14px',
                        background: solveGuardBlocked ? 'rgba(148, 163, 184, 0.2)' : '#fff',
                        cursor: solveGuardBlocked ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {solutionStatus === 'ready' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 16,
                        padding: '18px 20px',
                        background: 'rgba(255,255,255,0.9)',
                        maxHeight: 360,
                        overflowY: 'auto'
                      }}
                    >
                      {solutionContent && solutionContent.trim().length ? (
                        solutionParagraphs.map((paragraph, index) => (
                          <p key={index} style={{ margin: index === 0 ? '0 0 12px 0' : '12px 0', lineHeight: 1.6 }}>
                            {paragraph}
                          </p>
                        ))
                      ) : (
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                          We paused before completing this draft. Upgrade to Premium to unlock the remaining response instantly.
                        </p>
                      )}
                    </div>
                    {exportsEnabled ? (
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
                          onClick={handleCreateGoogleDoc}
                          disabled={!solutionContent || creatingGoogleDoc}
                          style={{
                            borderRadius: 999,
                            padding: '10px 22px',
                            border: '1px solid var(--surface-border)',
                            background: creatingGoogleDoc ? 'rgba(148,163,184,0.2)' : '#fff',
                            color: creatingGoogleDoc ? 'var(--text-secondary)' : 'var(--accent)',
                            cursor: !solutionContent || creatingGoogleDoc ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {creatingGoogleDoc
                            ? 'Connecting…'
                            : googleDocUrl
                              ? 'Update Google Doc'
                              : 'Create Google Doc'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={!solutionContent || exportingPdf}
                          style={{
                            borderRadius: 999,
                            padding: '10px 22px',
                            border: 'none',
                            background: '#0a84ff',
                            color: '#fff',
                            boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)',
                            cursor: !solutionContent || exportingPdf ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {exportingPdf ? 'Preparing PDF…' : 'Download PDF'}
                        </button>
                        {googleDocUrl ? (
                          <a
                            href={googleDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              fontWeight: 600
                            }}
                          >
                            Open in Google Docs
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {googleError ? (
                      <div
                        style={{
                          color: '#b45309',
                          background: 'rgba(251, 191, 36, 0.14)',
                          padding: '10px 14px',
                          borderRadius: 12
                        }}
                      >
                        {googleError}
                      </div>
                    ) : null}
                    {solutionLimitInfo ? (
                      <div
                        style={{
                          border: '1px solid rgba(14, 116, 144, 0.35)',
                          background: 'rgba(14, 116, 144, 0.08)',
                          color: '#0f172a',
                          borderRadius: 14,
                          padding: '14px 16px'
                        }}
                      >
                        <strong style={{ display: 'block', marginBottom: 4 }}>Unlock the rest with Premium</strong>
                        <span style={{ display: 'block', lineHeight: 1.5 }}>
                          We paused after using {solutionTokensUsed} tokens. Approximately {solutionLimitInfo.estimatedRemaining}
                          {' '}more tokens are required to finish this deliverable. Upgrade to Premium to continue instantly.
                        </span>
                        <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          Remaining this assignment: {Math.max(solutionLimitInfo.remainingAssignment, 0)} · Remaining today:
                          {' '}
                          {Math.max(solutionLimitInfo.remainingDaily, 0)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {solutionStatus === 'ready' ? (
                <StudyGuidePanel
                  plan={guidePlan}
                  status={guideStatus}
                  progress={guideProgress}
                  onGenerate={generateGuide}
                  canGenerate={solutionStatus === 'ready'}
                  error={guideError}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
