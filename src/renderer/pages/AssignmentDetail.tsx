import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment } from '../../lib/canvasClient';
import { useStore, type AssignmentContextEntry } from '../state/store';
import { buildSolutionContent, solutionTextToHtml } from '../utils/assignmentSolution';
import StudyGuidePanel from '../components/StudyGuidePanel';
import { buildStudyGuidePlan, type StudyGuidePlan } from '../utils/studyGuide';
import { featureFlags } from '../../shared/featureFlags';
import { isActualAssignment } from '../../shared/assignments';
import { getPlatformBridge } from '../../lib/platformBridge';
import type { TokenBudgetResponse } from '../../config/tokens';

const STUDY_COACH_LABEL = 'Study Coach';
const SUPPORTED_UPLOAD_EXTENSIONS = ['pdf', 'docx'] as const;
type SupportedUploadExtension = (typeof SUPPORTED_UPLOAD_EXTENSIONS)[number];

const platformBridge = getPlatformBridge();

function tokenise(text: string) {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countTokens(text: string) {
  return tokenise(text).length;
}

function trimToTokenBudget(content: string, allowedTokens: number) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  let usedTokens = 0;
  const collected: string[] = [];
  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    if (!sentenceTokens) {
      continue;
    }
    if (usedTokens + sentenceTokens > allowedTokens) {
      break;
    }
    collected.push(sentence);
    usedTokens += sentenceTokens;
  }

  if (collected.length) {
    return { text: collected.join(' '), tokensUsed: usedTokens };
  }

  const tokens = tokenise(content);
  const sliced = tokens.slice(0, Math.max(0, allowedTokens));
  const text = sliced.join(' ').trim();
  return { text: text.length ? `${text}…` : text, tokensUsed: sliced.length };
}

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length ? base : 'assignment';
}

function sanitizeCourseCode(input?: string) {
  if (!input) return 'COURSE';
  const compact = input.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
  return compact.length ? compact : 'COURSE';
}

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
  const profile = useStore((s) => s.profile);
  const setToast = useStore((s) => s.setToast);
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
  const [solutionHtml, setSolutionHtml] = useState<string | null>(null);
  const [tokenBudgetInfo, setTokenBudgetInfo] = useState<
    { limitType: TokenBudgetResponse['limitType']; estimatedRemainingTokens: number } | null
  >(null);
  const [googleDocStatus, setGoogleDocStatus] = useState<'idle' | 'creating' | 'ready' | 'error'>(
    'idle'
  );
  const [googleDocLink, setGoogleDocLink] = useState<string | null>(null);
  const [googleDocError, setGoogleDocError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'success' | 'error'>(
    'idle'
  );
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentLink[]>([]);
  const [canvasLink, setCanvasLink] = useState<string | null>(assignment?.html_url ?? null);
  const guardEnabled = featureFlags.assignmentSolveGuard;
  const [solveCheck, setSolveCheck] = useState<
    { status: 'idle' | 'checking' | 'allowed' | 'blocked'; reason?: string; confidence?: number }
  >({ status: guardEnabled ? 'checking' : 'allowed' });

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
    setSolutionHtml(null);
    setTokenBudgetInfo(null);
    setGoogleDocStatus('idle');
    setGoogleDocError(null);
    setGoogleDocLink(null);
    setPdfStatus('idle');
    setPdfError(null);
    lastContextSignatureRef.current = null;
    setAttachments([]);
    setCanvasLink(assignment?.html_url ?? null);
    setSolveCheck({ status: guardEnabled ? 'checking' : 'allowed' });
  }, [assignment?.id]);

  useEffect(() => {
    if (!featureFlags.solveExports) {
      setGoogleDocLink(null);
      setGoogleDocStatus('idle');
      setGoogleDocError(null);
      return;
    }

    if (!assignment) {
      setGoogleDocLink(null);
      setGoogleDocStatus('idle');
      setGoogleDocError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const existing = await platformBridge.exports.getGoogleDocument(assignment.id);
        if (cancelled) {
          return;
        }
        if (existing.ok) {
          if (existing.data) {
            setGoogleDocLink(existing.data.documentUrl);
            setGoogleDocStatus('ready');
          } else {
            setGoogleDocLink(null);
            setGoogleDocStatus('idle');
          }
          setGoogleDocError(null);
        } else {
          setGoogleDocLink(null);
          setGoogleDocStatus('idle');
          setGoogleDocError(existing.error);
        }
      } catch (error) {
        if (!cancelled) {
          setGoogleDocStatus('error');
          setGoogleDocError((error as Error).message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignment?.id]);

  useEffect(() => {
    if (!hasGuideContext) {
      setGuideExpanded(false);
    }
  }, [hasGuideContext]);

  useEffect(() => {
    if (solutionStatus === 'ready') {
      setGuideExpanded(true);
    }
  }, [solutionStatus]);

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
          setSolutionStatus('idle');
          setSolutionContent(null);
          setSolutionHtml(null);
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
      setSolutionHtml(null);
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
        if (!content.trim().length) {
          throw new Error('Generated solution was empty.');
        }

        let finalContent = content;
        let tokensUsed = countTokens(content);

        if (featureFlags.tokenGating && tokensUsed > 0) {
          const userId =
            profile?.primary_email?.trim().length
              ? profile.primary_email.trim()
              : profile?.name?.trim().length
                ? profile.name.trim()
                : 'anonymous-user';
          const budgetResult = await platformBridge.tokens.requestBudget({
            userId,
            assignmentId: assignment.id,
            courseId: assignment.course_id,
            requestedTokens: tokensUsed
          });
          if (!budgetResult.ok) {
            throw new Error(budgetResult.error || 'Unable to evaluate token budget.');
          }
          const budget = budgetResult.data;
          if (budget.allowedTokens < tokensUsed) {
            const trimmed = trimToTokenBudget(content, budget.allowedTokens);
            finalContent = trimmed.text;
            tokensUsed = trimmed.tokensUsed;
            setTokenBudgetInfo({
              limitType: budget.limitType,
              estimatedRemainingTokens: budget.estimatedRemainingTokens
            });
          } else {
            setTokenBudgetInfo(null);
          }
          const logResult = await platformBridge.tokens.logUsage({
            userId,
            assignmentId: assignment.id,
            courseId: assignment.course_id,
            tokensUsed
          });
          if (!logResult.ok) {
            throw new Error(logResult.error || 'Failed to record token usage.');
          }
        } else {
          setTokenBudgetInfo(null);
        }

        if (cancelled) {
          return;
        }

        setSolutionContent(finalContent);
        setSolutionHtml(solutionTextToHtml(finalContent));
        setSolutionStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setSolutionContent(null);
          setSolutionHtml(null);
          setSolutionStatus('error');
          setSolutionError((err as Error).message || 'Failed to generate the completed file.');
          setTokenBudgetInfo(null);
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
    setSolutionHtml(null);
    setTokenBudgetInfo(null);
    setGoogleDocStatus('idle');
    setGoogleDocLink(null);
    setGoogleDocError(null);
    setPdfStatus('idle');
    setPdfError(null);
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

  const handleCreateGoogleDoc = async () => {
    if (!assignment || !solutionContent || !featureFlags.solveExports) {
      return;
    }
    const account =
      profile?.primary_email?.trim().length
        ? profile.primary_email.trim()
        : profile?.name?.trim().length
          ? profile.name.trim()
          : 'anonymous-user';
    setGoogleDocStatus('creating');
    setGoogleDocError(null);
    try {
      const response = await platformBridge.exports.createGoogleDocument({
        assignmentId: assignment.id,
        courseId: assignment.course_id,
        account,
        title: assignment.name ?? 'Assignment',
        content: solutionContent
      });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to create Google Doc');
      }
      setGoogleDocLink(response.data.documentUrl);
      setGoogleDocStatus('ready');
      setGoogleDocError(null);
    } catch (error) {
      setGoogleDocStatus('error');
      setGoogleDocLink(null);
      setGoogleDocError((error as Error).message || 'Unable to create Google Doc.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!assignment || !solutionHtml || !featureFlags.solveExports) {
      return;
    }
    setPdfStatus('generating');
    setPdfError(null);
    try {
      const result = await platformBridge.exports.generatePdf({
        assignmentId: assignment.id,
        courseCode: sanitizeCourseCode(courseName),
        assignmentSlug: slugify(assignment.name ?? 'assignment'),
        htmlBody: solutionHtml
      });
      if (!result.ok) {
        if (result.status === 499) {
          setPdfStatus('idle');
          return;
        }
        throw new Error(result.error || 'Failed to export PDF');
      }
      setPdfStatus('success');
      setToast(`PDF saved to ${result.data.filePath}`);
    } catch (error) {
      if ((error as Error).message === 'cancelled') {
        setPdfStatus('idle');
        return;
      }
      setPdfStatus('error');
      setPdfError((error as Error).message || 'Unable to export PDF.');
    }
  };

  const handlePremiumUpsell = () => {
    setToast('Premium solves unlock the remaining tokens. Contact support to upgrade.');
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
      return Boolean(ext && SUPPORTED_UPLOAD_EXTENSIONS.includes(ext as SupportedUploadExtension));
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
                {solutionStatus === 'ready' && solutionContent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: 16,
                        padding: 20,
                        background: '#fff',
                        maxHeight: 360,
                        overflowY: 'auto'
                      }}
                      dangerouslySetInnerHTML={{ __html: solutionHtml ?? '' }}
                    />
                    {tokenBudgetInfo ? (
                      <div
                        style={{
                          border: '1px solid rgba(249, 115, 22, 0.4)',
                          background: 'rgba(249, 115, 22, 0.08)',
                          color: '#9a3412',
                          borderRadius: 14,
                          padding: '14px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <strong>Premium needed to finish the draft</strong>
                        <span>
                          We paused at the {tokenBudgetInfo.limitType === 'assignment' ? 'assignment' : 'daily'} token cap. Estimated tokens remaining:{' '}
                          {Math.max(0, Math.round(tokenBudgetInfo.estimatedRemainingTokens))}.
                        </span>
                        <button
                          type="button"
                          onClick={handlePremiumUpsell}
                          style={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            padding: '6px 16px',
                            border: 'none',
                            background: '#f97316',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Explore Premium options
                        </button>
                      </div>
                    ) : null}
                    {featureFlags.solveExports ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {googleDocLink ? (
                          <a
                            href={googleDocLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: 'var(--accent)',
                              color: '#fff',
                              borderRadius: 999,
                              padding: '10px 22px',
                              textDecoration: 'none',
                              boxShadow: '0 10px 20px rgba(10, 132, 255, 0.25)'
                            }}
                          >
                            Open in Google Docs
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={handleCreateGoogleDoc}
                            disabled={googleDocStatus === 'creating'}
                            style={{
                              border: '1px solid var(--surface-border)',
                              borderRadius: 999,
                              padding: '10px 22px',
                              background: googleDocStatus === 'creating' ? 'rgba(148, 163, 184, 0.2)' : '#fff',
                              color: 'var(--accent)',
                              cursor: googleDocStatus === 'creating' ? 'wait' : 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {googleDocStatus === 'creating' ? 'Creating Google Doc…' : 'Create Google Doc'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={pdfStatus === 'generating'}
                          style={{
                            border: '1px solid var(--surface-border)',
                            borderRadius: 999,
                            padding: '10px 22px',
                            background: pdfStatus === 'generating' ? 'rgba(148, 163, 184, 0.2)' : '#fff',
                            color: 'var(--accent)',
                            cursor: pdfStatus === 'generating' ? 'wait' : 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {pdfStatus === 'generating' ? 'Generating PDF…' : 'Download PDF'}
                        </button>
                      </div>
                    ) : null}
                    {googleDocError ? (
                      <span style={{ color: '#b91c1c', fontSize: 13 }}>{googleDocError}</span>
                    ) : null}
                    {pdfError ? <span style={{ color: '#b91c1c', fontSize: 13 }}>{pdfError}</span> : null}
                    {pdfStatus === 'success' ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        PDF saved successfully. You can regenerate it after making changes.
                      </span>
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
