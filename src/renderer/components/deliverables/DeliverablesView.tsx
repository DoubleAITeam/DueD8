import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ArtifactInput,
  ArtifactKind,
  DeliverableJobResult,
  DeliverableRunRecord,
  RunSummary,
  AiSummaryPayload
} from '../../../../electron/deliverables/types';
import type { AdapterOverviewEntry } from '../../../../electron/deliverables/renderers/registry';
import type { CourseContext, PostResult, Rule } from '../../../../electron/deliverables/postprocess/types';
import {
  discoverArtifacts,
  invokeDeliverablesPipeline,
  type DeliverablePipelineResult,
  fetchAdapterHealth,
  type DeliverablePipelineOptions,
  fetchRunSummary,
  rebuildRunSummary,
  exportRunReport,
  fetchAiSummary,
  fetchPostRules,
  savePostRules,
  resetPostRules,
  revealOutput,
  openOutput,
  trashOutput,
  createRunArchive,
  createSelectedArchive,
  sweepOutputs,
  fetchInsightBundle,
  buildInsightBundle,
  buildInsightAi,
  saveInsightEdits,
  isAiInsightsEnabled,
  fetchInsightRedactionInfo,
  type InsightCorrectionPatch
} from '../../utils/deliverables';
import { withBudgetGate } from '../../utils/withBudgetGate';
import { AiGenerationBadge } from '../ai/AiGenerationBadge';
import { useAiRuntimeState, selectAiBannerMessage, selectIsAiFrozen } from '../../state/ai';
import type { AiInsight, BaseInsight, InsightBundle } from '../../../../electron/deliverables/insights/types';
import type { RetentionSweepResult } from '../../../../electron/deliverables/retention';

const HISTORY_LIMIT = 10;
const IS_PRODUCTION = import.meta.env.MODE === 'production';

type AnnotatedResult = DeliverableJobResult & { type?: ArtifactKind };

function parseInputLines(raw: string): string[] {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

type PreviewMatch = { artifactPath: string; ruleIds: string[] };

function previewRuleMatches(rule: Rule, artifact: ArtifactInput): boolean {
  if (!rule.enabled) {
    return false;
  }
  const when = rule.when ?? {};

  if (when.type && when.type.length > 0 && !when.type.includes(artifact.type)) {
    return false;
  }

  if (when.adapterId && when.adapterId.length > 0) {
    return false;
  }

  if (when.badge && when.badge.length > 0 && !when.badge.includes('success')) {
    return false;
  }

  if (typeof when.minSizeMb === 'number' || typeof when.maxSizeMb === 'number') {
    return false;
  }

  if (when.pathIncludes && when.pathIncludes.length > 0) {
    const source = artifact.srcPath.toLowerCase();
    const allMatch = when.pathIncludes.every((needle) =>
      source.includes(String(needle).toLowerCase())
    );
    if (!allMatch) {
      return false;
    }
  }

  return true;
}

function buildPreviewMatches(rules: Rule[], artifacts: ArtifactInput[]): PreviewMatch[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [];
  }

  return artifacts.map((artifact) => ({
    artifactPath: artifact.srcPath,
    ruleIds: rules.filter((rule) => previewRuleMatches(rule, artifact)).map((rule) => rule.id)
  }));
}

type StoragePaths = { userData: string; outputs: string; archives: string };

function deriveStoragePaths(run: DeliverableRunRecord | null): StoragePaths | null {
  if (!run) {
    return null;
  }
  const firstOutput = run.results
    .map((result) => result.outputPath)
    .find((output): output is string => typeof output === 'string' && output.length > 0);
  if (!firstOutput) {
    return null;
  }
  const usesBackslash = firstOutput.includes('\\');
  const normalised = firstOutput.replace(/\\/g, '/');
  const marker = '/deliverables/outputs/';
  const markerIndex = normalised.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const base = normalised.slice(0, markerIndex);
  const sanitize = (value: string): string => {
    const trimmed = value.replace(/\/+$/g, '');
    const withMarker = trimmed.length > 0 ? trimmed : '/';
    return usesBackslash ? withMarker.replace(/\//g, '\\') : withMarker;
  };

  const buildPath = (suffix: string): string => {
    const separator = usesBackslash ? '\\' : '/';
    const cleanBase = sanitize(base);
    return `${cleanBase}${cleanBase.endsWith(separator) ? '' : separator}${suffix}`;
  };

  const userDataPath = sanitize(base);
  const outputsPath = buildPath('deliverables').concat(usesBackslash ? '\\outputs' : '/outputs');
  const archivesPath = buildPath('deliverables').concat(usesBackslash ? '\\archives' : '/archives');

  return {
    userData: userDataPath,
    outputs: outputsPath,
    archives: archivesPath
  };
}

export function DeliverablesView() {
  const [pathsInput, setPathsInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [latestRun, setLatestRun] = useState<DeliverableRunRecord | null>(null);
  const [latestSummary, setLatestSummary] = useState<RunSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryTab, setSummaryTab] = useState<'standard' | 'ai' | 'insights'>('standard');
  const [aiSummary, setAiSummary] = useState<AiSummaryPayload | null>(null);
  const [hasRequestedAiSummary, setHasRequestedAiSummary] = useState(false);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
  const [history, setHistory] = useState<DeliverableRunRecord[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [adapterHealth, setAdapterHealth] = useState<
    Record<ArtifactKind, AdapterOverviewEntry> | null
  >(null);
  const [postEnabled, setPostEnabled] = useState(false);
  const [postDryRun, setPostDryRun] = useState(true);
  const [courseId, setCourseId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [courseNameInput, setCourseNameInput] = useState('');
  const [dueDateIso, setDueDateIso] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesInput, setRulesInput] = useState('');
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([]);
  const [localActionMessage, setLocalActionMessage] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isZippingSelection, setIsZippingSelection] = useState(false);
  const [storagePaths, setStoragePaths] = useState<StoragePaths | null>(null);
  const [retentionPlan, setRetentionPlan] = useState<RetentionSweepResult | null>(null);
  const [isRunningRetention, setIsRunningRetention] = useState(false);
  const isAiFrozen = useAiRuntimeState(selectIsAiFrozen);
  const aiBannerMessage = useAiRuntimeState(selectAiBannerMessage);
  const [insightBundle, setInsightBundle] = useState<InsightBundle | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isBuildingBaseInsights, setIsBuildingBaseInsights] = useState(false);
  const [isBuildingAiInsights, setIsBuildingAiInsights] = useState(false);
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(false);
  const [redactionInfo, setRedactionInfo] = useState<{ enabled: boolean; patterns: string[] } | null>(null);
  const [insightCorrection, setInsightCorrection] = useState<{
    artifactId: string;
    title: string;
    detectedCourseId: string;
    detectedAssignmentId: string;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    if (IS_PRODUCTION) {
      return;
    }
    setIsLoadingHistory(true);
    try {
      const runs = await window.electron.invoke('deliverables:getRuns', HISTORY_LIMIT);
      setHistory(runs);
    } catch (error) {
      console.error('[DeliverablesView] Failed to load history', error);
      setStatus((previous) =>
        previous ?? 'Failed to refresh deliverables history. Check console for details.'
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadAdapterHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const snapshot = await fetchAdapterHealth();
      setAdapterHealth(snapshot);
    } catch (error) {
      console.error('[DeliverablesView] Failed to load adapter health', error);
      setStatus((previous) => previous ?? 'Failed to load renderer health information.');
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setIsLoadingRules(true);
    try {
      const snapshot = await fetchPostRules();
      setRules(snapshot);
      setRulesInput(JSON.stringify(snapshot, null, 2));
      setRulesError(null);
    } catch (error) {
      console.error('[DeliverablesView] Failed to load post-processing rules', error);
      setRulesError('Failed to load post-processing rules.');
      setStatus((previous) => previous ?? 'Failed to load post-processing rules.');
    } finally {
      setIsLoadingRules(false);
    }
  }, [setStatus]);

  useEffect(() => {
    setStoragePaths(deriveStoragePaths(latestRun));
    setSelectedArtifacts([]);
    setRetentionPlan(null);
    setLocalActionMessage(null);
  }, [latestRun]);

  useEffect(() => {
    let cancelled = false;
    isAiInsightsEnabled()
      .then((enabled) => {
        if (!cancelled) {
          setAiInsightsEnabled(Boolean(enabled));
        }
      })
      .catch((error) => {
        console.error('[DeliverablesView] Failed to check AI insights availability', error);
      });
    fetchInsightRedactionInfo()
      .then((info) => {
        if (!cancelled) {
          setRedactionInfo(info);
        }
      })
      .catch((error) => {
        console.error('[DeliverablesView] Failed to load insight redaction info', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!latestRun?.runId) {
      setInsightBundle(null);
      return;
    }
    setIsLoadingInsights(true);
    fetchInsightBundle(latestRun.runId)
      .then((bundle) => {
        if (!cancelled) {
          setInsightBundle(bundle);
        }
      })
      .catch((error) => {
        console.error('[DeliverablesView] Failed to load insights', error);
        if (!cancelled) {
          setStatus((previous) => previous ?? 'Failed to load insights.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingInsights(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [latestRun?.runId, setStatus]);

  const courseContext = useMemo<CourseContext>(() => {
    const context: CourseContext = {};
    if (courseId.trim()) {
      context.courseId = courseId.trim();
    }
    if (assignmentId.trim()) {
      context.assignmentId = assignmentId.trim();
    }
    if (courseNameInput.trim()) {
      context.courseName = courseNameInput.trim();
    }
    if (dueDateIso.trim()) {
      context.dueDateIso = dueDateIso.trim();
    }
    return context;
  }, [assignmentId, courseId, courseNameInput, dueDateIso]);

  const hasCourseContext = useMemo(() => Object.keys(courseContext).length > 0, [courseContext]);

  const loadSummaryForRun = useCallback(
    async (runId: string, options?: { rebuild?: boolean }) => {
      if (!runId) {
        setLatestSummary(null);
        return null;
      }

      setSummaryTab('standard');
      setAiSummary(null);
      setHasRequestedAiSummary(false);
      setIsLoadingAiSummary(false);
      setIsLoadingSummary(true);

      try {
        const loader = options?.rebuild ? rebuildRunSummary : fetchRunSummary;
        const summary = await loader(runId);
        if (summary) {
          setLatestSummary(summary);
          return summary;
        }

        if (options?.rebuild) {
          setStatus((previous) => previous ?? 'Failed to rebuild run summary.');
        }
        return null;
      } catch (error) {
        console.error('[DeliverablesView] Failed to load summary', error);
        setStatus((previous) => previous ?? 'Failed to load run summary.');
        return null;
      } finally {
        setIsLoadingSummary(false);
      }
    },
    [setStatus]
  );

  const handlePipelineResult = useCallback(
    (result: DeliverablePipelineResult, artifacts: ArtifactInput[]) => {
      setLatestSummary(null);
      setSummaryTab('standard');
      setAiSummary(null);
      setHasRequestedAiSummary(false);
      setIsLoadingAiSummary(false);
      setLatestRun(result.run);
      setStatus(
        result.success
          ? 'Deliverables pipeline completed successfully.'
          : 'Deliverables pipeline completed with issues.'
      );

      setHistory((previous) => {
        const next = [result.run, ...previous];
        return next.slice(0, HISTORY_LIMIT);
      });

      if (!IS_PRODUCTION) {
        loadHistory().catch((error) => {
          console.error('[DeliverablesView] Failed to refresh history after run', error);
        });
      }

      loadAdapterHealth().catch((error) => {
        console.error('[DeliverablesView] Failed to refresh adapter health', error);
      });

      if (artifacts.length > 0) {
        setPathsInput(artifacts.map((artifact) => artifact.srcPath).join('\n'));
      }
    },
    [loadHistory, loadAdapterHealth]
  );

  useEffect(() => {
    loadHistory().catch((error) => {
      console.error('[DeliverablesView] Initial history load failed', error);
    });
    loadAdapterHealth().catch((error) => {
      console.error('[DeliverablesView] Initial adapter health load failed', error);
    });
    loadRules().catch((error) => {
      console.error('[DeliverablesView] Initial rules load failed', error);
    });
  }, [loadAdapterHealth, loadHistory, loadRules]);

  useEffect(() => {
    const runId = latestRun?.runId;
    if (!runId) {
      setLatestSummary(null);
      return;
    }
    void loadSummaryForRun(runId);
  }, [latestRun?.runId, loadSummaryForRun]);

  useEffect(() => {
    const postOptions = latestRun?.options?.post;
    if (postOptions) {
      setPostEnabled(Boolean(postOptions.enable));
      if (typeof postOptions.dryRun === 'boolean') {
        setPostDryRun(Boolean(postOptions.dryRun));
      }
    }
    const ctx = latestRun?.post?.ctx;
    if (ctx) {
      setCourseId(ctx.courseId ?? '');
      setAssignmentId(ctx.assignmentId ?? '');
      setCourseNameInput(ctx.courseName ?? '');
      setDueDateIso(ctx.dueDateIso ?? '');
    }
  }, [latestRun?.options?.post, latestRun?.post?.ctx]);

  const handleDiscoverAndRun = useCallback(async () => {
    setIsRunning(true);
    setStatus(null);

    try {
      const lines = parseInputLines(pathsInput);
      const artifacts = discoverArtifacts(lines);

      if (artifacts.length === 0) {
        setStatus('No supported artifacts found. Provide absolute file paths to pdf, docx, or html files.');
        return;
      }

      const postOptions = postEnabled
        ? {
            enable: true,
            dryRun: postDryRun,
            ctx: hasCourseContext ? courseContext : undefined
          }
        : undefined;
      const options: DeliverablePipelineOptions = { dryRun, post: postOptions };
      const runWithGate = withBudgetGate(
        'deliverables.pipeline',
        (nextArtifacts: ArtifactInput[], nextOptions: DeliverablePipelineOptions) =>
          invokeDeliverablesPipeline(nextArtifacts, nextOptions)
      );
      const result = await runWithGate(artifacts, options);
      handlePipelineResult(result, artifacts);
    } catch (error) {
      if ((error as { code?: string }).code === 'E_BUDGET_EXCEEDED') {
        setStatus('Token limit reached. Upgrade your plan to keep generating.');
        return;
      }
      console.error('[DeliverablesView] Pipeline invocation failed', error);
      setStatus(error instanceof Error ? error.message : 'Failed to run deliverables pipeline.');
    } finally {
      setIsRunning(false);
    }
  }, [courseContext, dryRun, handlePipelineResult, hasCourseContext, pathsInput, postDryRun, postEnabled]);

  const handleSaveRules = useCallback(async () => {
    setRulesError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rulesInput);
    } catch (error) {
      setRulesError(error instanceof Error ? error.message : 'Invalid JSON for rules.');
      return;
    }

    if (!Array.isArray(parsed)) {
      setRulesError('Rules JSON must be an array.');
      return;
    }

    setIsSavingRules(true);
    try {
      const response = await savePostRules(parsed as Rule[]);
      if (!response.ok) {
        setRulesError(response.message ?? 'Failed to save rules.');
        return;
      }
      setRules(parsed as Rule[]);
      setStatus('Post-processing rules saved.');
    } catch (error) {
      console.error('[DeliverablesView] Failed to save post-processing rules', error);
      setRulesError('Failed to save post-processing rules.');
    } finally {
      setIsSavingRules(false);
    }
  }, [rulesInput, setStatus]);

  const handleResetRules = useCallback(async () => {
    setIsSavingRules(true);
    try {
      const snapshot = await resetPostRules();
      setRules(snapshot);
      setRulesInput(JSON.stringify(snapshot, null, 2));
      setRulesError(null);
      setStatus('Post-processing rules reset to defaults.');
    } catch (error) {
      console.error('[DeliverablesView] Failed to reset post-processing rules', error);
      setRulesError('Failed to reset post-processing rules.');
    } finally {
      setIsSavingRules(false);
    }
  }, [setStatus]);

  const handleRefreshHistory = useCallback(() => {
    if (IS_PRODUCTION) {
      return;
    }
    loadHistory().catch((error) => {
      console.error('[DeliverablesView] Manual history refresh failed', error);
    });
  }, [loadHistory]);

  const handleResetHistory = useCallback(async () => {
    if (IS_PRODUCTION) {
      return;
    }
    try {
      await window.electron.invoke('deliverables:resetRuns');
      setHistory([]);
      setStatus('Deliverables history has been reset.');
    } catch (error) {
      console.error('[DeliverablesView] Failed to reset history', error);
      setStatus(error instanceof Error ? error.message : 'Failed to reset deliverables history.');
    }
  }, []);

  const handleBuildBaseInsights = useCallback(async () => {
    if (!latestRun?.runId) {
      setStatus((previous) => previous ?? 'No run selected for insights.');
      return;
    }
    setIsBuildingBaseInsights(true);
    try {
      const bundle = await buildInsightBundle(latestRun.runId);
      if (bundle) {
        setInsightBundle(bundle);
        setStatus('Base insights generated.');
      } else {
        setStatus((previous) => previous ?? 'No insights generated for this run.');
      }
    } catch (error) {
      console.error('[DeliverablesView] Failed to build base insights', error);
      setStatus((previous) => previous ?? 'Failed to build base insights.');
    } finally {
      setIsBuildingBaseInsights(false);
    }
  }, [latestRun, setStatus]);

  const handleBuildAiInsights = useCallback(async () => {
    if (!latestRun?.runId) {
      setStatus((previous) => previous ?? 'No run selected for insights.');
      return;
    }
    if (!insightBundle) {
      setStatus((previous) => previous ?? 'Build base insights before requesting AI.');
      return;
    }
    setIsBuildingAiInsights(true);
    try {
      const updated = await buildInsightAi(latestRun.runId);
      if (updated) {
        setInsightBundle(updated);
        setStatus('AI insights updated.');
      } else {
        setStatus((previous) => previous ?? 'AI insights unavailable for this run.');
      }
    } catch (error) {
      console.error('[DeliverablesView] Failed to build AI insights', error);
      setStatus((previous) => previous ?? 'Failed to build AI insights.');
    } finally {
      setIsBuildingAiInsights(false);
    }
  }, [insightBundle, latestRun, setStatus]);

  const handleCopyInsightText = useCallback(
    async (text: string, label: string) => {
      if (!text) {
        setStatus((previous) => previous ?? `No ${label.toLowerCase()} available to copy.`);
        return;
      }
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
          throw new Error('Clipboard API unavailable');
        }
        await navigator.clipboard.writeText(text);
        setStatus(`${label} copied to clipboard.`);
      } catch (error) {
        console.error('[DeliverablesView] Failed to copy insight text', error);
        setStatus((previous) => previous ?? `Failed to copy ${label.toLowerCase()}.`);
      }
    },
    [setStatus]
  );

  const handleOpenInsightCorrection = useCallback(
    (artifactId: string) => {
      if (!insightBundle) {
        return;
      }
      const base = insightBundle.base[artifactId];
      if (!base) {
        return;
      }
      setInsightCorrection({
        artifactId,
        title: base.title ?? '',
        detectedCourseId: base.detectedCourseId ?? '',
        detectedAssignmentId: base.detectedAssignmentId ?? ''
      });
    },
    [insightBundle]
  );

  const handleInsightCorrectionChange = useCallback(
    (field: 'title' | 'detectedCourseId' | 'detectedAssignmentId', value: string) => {
      setInsightCorrection((current) => (current ? { ...current, [field]: value } : current));
    },
    []
  );

  const handleCancelInsightCorrection = useCallback(() => {
    setInsightCorrection(null);
  }, []);

  const handleSaveInsightCorrection = useCallback(async () => {
    if (!latestRun?.runId || !insightCorrection) {
      return;
    }
    try {
      const patch: InsightCorrectionPatch = {
        title: insightCorrection.title,
        detectedCourseId: insightCorrection.detectedCourseId,
        detectedAssignmentId: insightCorrection.detectedAssignmentId
      };
      const updated = await saveInsightEdits(latestRun.runId, insightCorrection.artifactId, patch);
      if (updated) {
        setInsightBundle(updated);
        setInsightCorrection(null);
        setStatus('Insight correction saved.');
      } else {
        setStatus((previous) => previous ?? 'Failed to save insight correction.');
      }
    } catch (error) {
      console.error('[DeliverablesView] Failed to save insight correction', error);
      setStatus((previous) => previous ?? 'Failed to save insight correction.');
    }
  }, [insightCorrection, latestRun, setStatus]);

  const handleSummaryTabChange = useCallback(
    (tab: 'standard' | 'ai' | 'insights') => {
      setSummaryTab(tab);
      if (tab !== 'ai') {
        return;
      }

      setHasRequestedAiSummary(true);

      if (!latestRun?.runId) {
        setStatus((previous) => previous ?? 'No run selected for AI summary.');
        return;
      }

      if (isLoadingAiSummary) {
        return;
      }

      if (aiSummary?.content && aiSummary.content.length > 0) {
        return;
      }

      setIsLoadingAiSummary(true);
      fetchAiSummary(latestRun.runId)
        .then((value) => {
          setAiSummary(value ?? null);
          if (!value) {
            setStatus((previous) =>
              previous ??
              'AI summary unavailable. Enable DELIV_AI_SUMMARY=1 and provide an API key to generate summaries.'
            );
          } else {
            setStatus(
              `AI summary generated with ${value.model} • ${value.modelGeneration} / ${value.promptPackVersion}`
            );
          }
        })
        .catch((error) => {
          console.error('[DeliverablesView] Failed to load AI summary', error);
          setStatus((previous) => previous ?? 'Failed to load AI summary.');
        })
        .finally(() => {
          setIsLoadingAiSummary(false);
        });
    },
    [aiSummary, isLoadingAiSummary, latestRun, setStatus]
  );

  const handleRebuildSummary = useCallback(async () => {
    if (!latestRun?.runId) {
      setStatus((previous) => previous ?? 'No deliverables run available to summarise.');
      return;
    }
    const rebuilt = await loadSummaryForRun(latestRun.runId, { rebuild: true });
    if (rebuilt) {
      setStatus('Run summary rebuilt.');
    }
  }, [latestRun, loadSummaryForRun]);

  const handleExportReportClick = useCallback(
    async (format: 'html' | 'json') => {
      if (!latestRun?.runId) {
        setStatus((previous) => previous ?? 'No deliverables run available to export.');
        return;
      }
      try {
        const outputPath = await exportRunReport(latestRun.runId, format);
        if (outputPath) {
          setStatus(`Report exported to ${outputPath}`);
        } else {
          setStatus('Failed to export deliverables report.');
        }
      } catch (error) {
        console.error('[DeliverablesView] Failed to export report', error);
        setStatus('Failed to export deliverables report.');
      }
    },
    [latestRun]
  );

  const handleCopyHeadline = useCallback(async () => {
    if (!latestSummary?.headline) {
      setStatus((previous) => previous ?? 'No summary headline available to copy.');
      return;
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable.');
      }
      await navigator.clipboard.writeText(latestSummary.headline);
      setStatus('Summary headline copied to clipboard.');
    } catch (error) {
      console.error('[DeliverablesView] Failed to copy headline', error);
      setStatus('Failed to copy summary headline.');
    }
  }, [latestSummary]);

  const latestResults: AnnotatedResult[] = useMemo(() => {
    return ((latestRun?.results ?? []) as AnnotatedResult[]).map((result) => ({
      ...result
    }));
  }, [latestRun]);

  const selectableArtifactIds = useMemo(
    () => Array.from(new Set(latestResults.map((result) => result.id))),
    [latestResults]
  );
  const selectedSet = useMemo(() => new Set(selectedArtifacts), [selectedArtifacts]);
  const isAllSelected = useMemo(() => {
    if (selectableArtifactIds.length === 0) {
      return false;
    }
    return selectableArtifactIds.every((id) => selectedSet.has(id));
  }, [selectableArtifactIds, selectedSet]);
  const hasSelection = selectedArtifacts.length > 0;

  const handleToggleSelection = useCallback((artifactId: string) => {
    setSelectedArtifacts((previous) => {
      if (previous.includes(artifactId)) {
        return previous.filter((id) => id !== artifactId);
      }
      return [...previous, artifactId];
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedArtifacts(selectableArtifactIds);
      } else {
        setSelectedArtifacts([]);
      }
    },
    [selectableArtifactIds]
  );

  const handleRevealOutput = useCallback(async (outputPath?: string) => {
    if (!outputPath) {
      setLocalActionMessage('No local output available for this artifact.');
      return;
    }
    try {
      const ok = await revealOutput(outputPath);
      setLocalActionMessage(
        ok ? `Revealed in file manager: ${outputPath}` : 'Unable to reveal the selected artifact.'
      );
    } catch (error) {
      console.error('[DeliverablesView] Failed to reveal output', error);
      setLocalActionMessage('Failed to reveal the selected artifact.');
    }
  }, []);

  const handleOpenOutput = useCallback(async (outputPath?: string) => {
    if (!outputPath) {
      setLocalActionMessage('No local output available for this artifact.');
      return;
    }
    try {
      const result = await openOutput(outputPath);
      setLocalActionMessage(
        result.ok ? `Opened ${outputPath}` : result.message ?? 'Failed to open the selected output.'
      );
    } catch (error) {
      console.error('[DeliverablesView] Failed to open output', error);
      setLocalActionMessage('Failed to open the selected output.');
    }
  }, []);

  const handleTrashOutput = useCallback(async (outputPath?: string) => {
    if (!outputPath) {
      setLocalActionMessage('No local output available for this artifact.');
      return;
    }
    const confirmed = window.confirm('Move this output to the system trash?');
    if (!confirmed) {
      return;
    }
    try {
      const result = await trashOutput(outputPath);
      setLocalActionMessage(
        result.ok ? `Moved to trash: ${outputPath}` : result.message ?? 'Failed to move output to trash.'
      );
    } catch (error) {
      console.error('[DeliverablesView] Failed to move output to trash', error);
      setLocalActionMessage('Failed to move output to trash.');
    }
  }, []);

  const handleArchiveRun = useCallback(async () => {
    if (!latestRun?.runId) {
      setLocalActionMessage('No deliverables run available to archive.');
      return;
    }
    setIsArchiving(true);
    try {
      const result = await createRunArchive(latestRun.runId);
      setLocalActionMessage(
        result.ok && result.archivePath
          ? `Archive created at ${result.archivePath}`
          : result.message ?? 'Failed to create archive.'
      );
    } catch (error) {
      console.error('[DeliverablesView] Failed to create run archive', error);
      setLocalActionMessage('Failed to create archive.');
    } finally {
      setIsArchiving(false);
    }
  }, [latestRun]);

  const handleZipSelection = useCallback(async () => {
    if (!latestRun?.runId) {
      setLocalActionMessage('No deliverables run available to archive.');
      return;
    }
    if (selectedArtifacts.length === 0) {
      setLocalActionMessage('Select at least one artifact to create a focused archive.');
      return;
    }
    setIsZippingSelection(true);
    try {
      const result = await createSelectedArchive(latestRun.runId, selectedArtifacts);
      setLocalActionMessage(
        result.ok && result.archivePath
          ? `Archive created at ${result.archivePath}`
          : result.message ?? 'Failed to create archive for selected artifacts.'
      );
    } catch (error) {
      console.error('[DeliverablesView] Failed to create selected archive', error);
      setLocalActionMessage('Failed to create archive for selected artifacts.');
    } finally {
      setIsZippingSelection(false);
    }
  }, [latestRun, selectedArtifacts]);

  const handleRetentionDryRun = useCallback(async () => {
    setIsRunningRetention(true);
    try {
      const plan = await sweepOutputs({ dryRun: true });
      setRetentionPlan(plan);
      setLocalActionMessage(`Retention dry run would remove ${plan.removed.length} paths.`);
    } catch (error) {
      console.error('[DeliverablesView] Retention dry run failed', error);
      setLocalActionMessage('Retention dry run failed.');
    } finally {
      setIsRunningRetention(false);
    }
  }, []);

  const handleRetentionApply = useCallback(async () => {
    const confirmed = window.confirm('Apply the retention policy now? This will move old outputs to the trash.');
    if (!confirmed) {
      return;
    }
    setIsRunningRetention(true);
    try {
      const result = await sweepOutputs({ dryRun: false });
      setRetentionPlan(result);
      setLocalActionMessage(`Retention removed ${result.removed.length} paths.`);
    } catch (error) {
      console.error('[DeliverablesView] Retention apply failed', error);
      setLocalActionMessage('Retention apply failed.');
    } finally {
      setIsRunningRetention(false);
    }
  }, []);

  const postByArtifact = useMemo(() => {
    const map = new Map<string, PostResult>();
    const entries = latestRun?.post?.results ?? [];
    for (const entry of entries) {
      map.set(entry.artifactId, entry);
    }
    return map;
  }, [latestRun?.post?.results]);

  const previewArtifacts = useMemo(() => {
    if (!postEnabled) {
      return [] as ArtifactInput[];
    }
    const lines = parseInputLines(pathsInput);
    return discoverArtifacts(lines);
  }, [pathsInput, postEnabled]);

  const postPreview = useMemo(() => {
    if (!postEnabled) {
      return [] as PreviewMatch[];
    }
    return buildPreviewMatches(rules, previewArtifacts);
  }, [postEnabled, previewArtifacts, rules]);

  const summaryChips = useMemo(() => {
    if (!latestSummary) {
      return [] as Array<{ key: string; label: string; value: string }>;
    }

    const chips: Array<{ key: string; label: string; value: string }> = [
      { key: 'total', label: 'Total', value: String(latestSummary.totals.count) },
      { key: 'ok', label: 'Success', value: String(latestSummary.totals.ok) },
      { key: 'failed', label: 'Failed', value: String(latestSummary.totals.failed) },
      { key: 'cancelled', label: 'Cancelled', value: String(latestSummary.totals.cancelled) },
      { key: 'skipped', label: 'Skipped', value: String(latestSummary.totals.skipped) }
    ];

    for (const [kind, stats] of Object.entries(latestSummary.byType)) {
      chips.push({
        key: `type-${kind}`,
        label: kind.toUpperCase(),
        value: `${stats.ok}/${stats.count}`
      });
    }

    return chips;
  }, [latestSummary]);

  const insightRows = useMemo(
    (): Array<{ base: BaseInsight; ai?: AiInsight }> => {
      if (!insightBundle || !latestRun) {
        return [];
      }
      const baseEntries = insightBundle.base;
      const aiEntries = insightBundle.ai ?? {};
      return latestRun.results
        .filter((result) => result.success && Boolean(baseEntries[result.id]))
        .map((result) => ({ base: baseEntries[result.id]!, ai: aiEntries[result.id] }));
    },
    [insightBundle, latestRun]
  );

  const redactionTooltip = useMemo(() => {
    if (!redactionInfo) {
      return 'Redaction status unavailable';
    }
    if (!redactionInfo.enabled) {
      return 'Redaction disabled for insights';
    }
    return `Redacts: ${redactionInfo.patterns.join(', ')}`;
  }, [redactionInfo]);

  return (
    <div className="deliverables-view">
      <div className="deliverables-ai-status">
        <AiGenerationBadge />
        {isAiFrozen ? <span className="deliverables-ai-status__message">{aiBannerMessage}</span> : null}
      </div>
      <h2>Deliverables Pipeline</h2>

      <label className="deliverables-input">
        <span>Artifact file paths (one per line)</span>
        <textarea
          rows={6}
          value={pathsInput}
          onChange={(event) => setPathsInput(event.target.value)}
          placeholder="/absolute/path/to/file.pdf"
        />
      </label>

      <div className="deliverables-actions">
        <button type="button" onClick={handleDiscoverAndRun} disabled={isRunning || isAiFrozen}>
          {isRunning ? 'Running…' : isAiFrozen ? 'Frozen during AI reset' : 'Discover and Run'}
        </button>
        <label className="deliverables-dry-run">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
            disabled={isRunning || isAiFrozen}
          />
          Dry run
        </label>
        {!IS_PRODUCTION && (
          <>
            <button type="button" onClick={handleRefreshHistory} disabled={isLoadingHistory}>
              {isLoadingHistory ? 'Refreshing…' : 'Refresh History'}
            </button>
            <button type="button" onClick={handleResetHistory}>
              Reset History
            </button>
          </>
        )}
      </div>

      <section className="deliverables-post">
        <h3>Post-processing</h3>
        <div className="deliverables-post-toggles">
          <label>
            <input
              type="checkbox"
              checked={postEnabled}
              onChange={(event) => setPostEnabled(event.target.checked)}
              disabled={isRunning}
            />
            Enable post-processing
          </label>
          <label>
            <input
              type="checkbox"
              checked={postDryRun}
              onChange={(event) => setPostDryRun(event.target.checked)}
              disabled={!postEnabled || isRunning}
            />
            Post dry-run
          </label>
        </div>
        <div className="deliverables-post-grid">
          <label>
            <span>Course ID</span>
            <input
              type="text"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={!postEnabled}
            />
          </label>
          <label>
            <span>Assignment ID</span>
            <input
              type="text"
              value={assignmentId}
              onChange={(event) => setAssignmentId(event.target.value)}
              disabled={!postEnabled}
            />
          </label>
          <label>
            <span>Course name</span>
            <input
              type="text"
              value={courseNameInput}
              onChange={(event) => setCourseNameInput(event.target.value)}
              disabled={!postEnabled}
            />
          </label>
          <label>
            <span>Due date (ISO)</span>
            <input
              type="text"
              value={dueDateIso}
              onChange={(event) => setDueDateIso(event.target.value)}
              disabled={!postEnabled}
              placeholder="2024-05-01"
            />
          </label>
        </div>
        <div className="deliverables-rules-editor">
          <h4>Rules</h4>
          {isLoadingRules ? (
            <p>Loading rules…</p>
          ) : (
            <>
              <textarea
                value={rulesInput}
                onChange={(event) => setRulesInput(event.target.value)}
                disabled={isSavingRules}
                rows={10}
              />
              {rulesError && <p className="deliverables-rules-error">{rulesError}</p>}
              <div className="deliverables-rules-actions">
                <button type="button" onClick={handleSaveRules} disabled={isSavingRules}>
                  {isSavingRules ? 'Saving…' : 'Save rules'}
                </button>
                <button type="button" onClick={handleResetRules} disabled={isSavingRules}>
                  Reset to defaults
                </button>
              </div>
            </>
          )}
        </div>
        {postEnabled && (
          <div className="deliverables-post-preview">
            <h4>Preview</h4>
            <p className="deliverables-post-note">
              Preview assumes successful renders and ignores adapter or size filters.
            </p>
            {previewArtifacts.length === 0 ? (
              <p>Add artifact paths above to preview matching rules.</p>
            ) : postPreview.length === 0 ? (
              <p>No rules would apply to the current selection.</p>
            ) : (
              <ul>
                {postPreview.map((entry) => (
                  <li key={entry.artifactPath}>
                    <strong>{entry.artifactPath}</strong> —{' '}
                    {entry.ruleIds.length > 0
                      ? entry.ruleIds.join(', ')
                      : 'No matching rules'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {status && <p data-testid="deliverables-status">{status}</p>}

      <section className="deliverables-health">
        <h3>Render features</h3>
        <p className="deliverables-health-note">Features are optional. Disable if flaky.</p>
        {isLoadingHealth && <p>Checking adapters…</p>}
        {!isLoadingHealth && adapterHealth && (
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Desired</th>
                <th>Fallback</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(adapterHealth) as Array<[ArtifactKind, AdapterOverviewEntry]>).map(([kind, info]) => (
                <tr key={kind}>
                  <td>{kind}</td>
                  <td>
                    <div>{info.preferredAdapterId ?? '—'}</div>
                    {info.preferredHealth && (
                      <div
                        className={`deliverables-health-status ${info.preferredHealth.ok ? 'ok' : 'error'}`}
                      >
                        {info.preferredHealth.ok ? 'Healthy' : 'Unavailable'}
                        {info.preferredHealth.message ? ` — ${info.preferredHealth.message}` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{info.fallbackAdapterId ?? '—'}</div>
                    {info.fallbackAdapterId && info.fallbackHealth ? (
                      <div
                        className={`deliverables-health-status ${info.fallbackHealth.ok ? 'ok' : 'error'}`}
                      >
                        {info.fallbackHealth.ok ? 'Ready' : 'Unavailable'}
                        {info.fallbackHealth.message ? ` — ${info.fallbackHealth.message}` : ''}
                      </div>
                    ) : (
                      <div className="deliverables-health-status muted">—</div>
                    )}
                  </td>
                  <td>
                    <div>
                      {info.selectedAdapterId}
                      {info.usingFallback && (
                        <span className="deliverables-fallback-indicator"> (fallback)</span>
                      )}
                    </div>
                    <div
                      className={`deliverables-health-status ${info.selectedHealth.ok ? 'ok' : 'error'}`}
                    >
                      {info.selectedHealth.ok ? 'Healthy' : 'Unavailable'}
                      {info.selectedHealth.message ? ` — ${info.selectedHealth.message}` : ''}
                    </div>
                    <div className="deliverables-health-message">{info.reason}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(latestRun || isLoadingSummary) && (
        <section className="deliverables-summary">
          <div className="deliverables-summary-header">
            <h3>
              Run Summary{latestRun?.runId ? ` (${latestRun.runId})` : ''}
            </h3>
            <div className="deliverables-summary-actions">
              <button
                type="button"
                onClick={handleCopyHeadline}
                disabled={!latestSummary?.headline}
              >
                Copy headline
              </button>
              <button
                type="button"
                onClick={() => handleExportReportClick('html')}
                disabled={!latestRun?.runId}
              >
                Export HTML
              </button>
              <button
                type="button"
                onClick={() => handleExportReportClick('json')}
                disabled={!latestRun?.runId}
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleRebuildSummary}
                disabled={!latestRun?.runId || isLoadingSummary}
              >
                {isLoadingSummary ? 'Rebuilding…' : 'Rebuild summary'}
              </button>
            </div>
          </div>
          {isLoadingSummary && <p>Loading summary…</p>}
          {!isLoadingSummary && latestSummary && (
            <>
              <div className="deliverables-summary-tabs">
                <button
                  type="button"
                  className={`deliverables-summary-tab ${summaryTab === 'standard' ? 'active' : ''}`}
                  onClick={() => handleSummaryTabChange('standard')}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`deliverables-summary-tab ${summaryTab === 'ai' ? 'active' : ''}`}
                  onClick={() => handleSummaryTabChange('ai')}
                >
                  AI
                </button>
                <button
                  type="button"
                  className={`deliverables-summary-tab ${summaryTab === 'insights' ? 'active' : ''}`}
                  onClick={() => handleSummaryTabChange('insights')}
                >
                  Insights
                </button>
              </div>
              <div className="deliverables-summary-body">
                {(summaryTab === 'standard' || summaryTab === 'ai') && (
                  <div className="deliverables-summary-chips">
                    {summaryChips.map((chip) => (
                      <span key={chip.key} className="deliverables-summary-chip">
                        <strong>{chip.label}</strong>
                        {chip.value}
                      </span>
                    ))}
                  </div>
                )}
                {summaryTab === 'standard' && (
                  <>
                    <p className="deliverables-summary-headline">{latestSummary.headline}</p>
                    {latestRun?.post && (
                      <p className="deliverables-post-run-summary">
                        Post-processing {latestRun.post.dryRun ? '(dry run) ' : ''}
                        {latestRun.post.success ? 'completed successfully.' : 'reported issues.'}
                      </p>
                    )}
                    <ul className="deliverables-summary-bullets">
                      {latestSummary.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </>
                )}
                {summaryTab === 'ai' && (
                  <div className="deliverables-summary-ai">
                    {isLoadingAiSummary ? (
                      <p>Generating AI summary…</p>
                    ) : aiSummary ? (
                      <div className="deliverables-summary-ai-result">
                        <p>{aiSummary.content}</p>
                        <div className="deliverables-summary-ai-tags">
                          <span>{aiSummary.model}</span>
                          <span>{aiSummary.modelGeneration}</span>
                          <span>{aiSummary.promptPackVersion}</span>
                        </div>
                      </div>
                    ) : hasRequestedAiSummary ? (
                      <p>
                        AI summary unavailable. Ensure DELIV_AI_SUMMARY=1 and provide an OpenAI API key.
                      </p>
                    ) : (
                      <p>Select the AI tab to generate a condensed summary.</p>
                    )}
                  </div>
                )}
                {summaryTab === 'insights' && (
                  <div className="deliverables-insights-panel">
                    <div className="deliverables-insights-controls">
                      <button
                        type="button"
                        onClick={handleBuildBaseInsights}
                        disabled={!latestRun?.runId || isBuildingBaseInsights}
                      >
                        {isBuildingBaseInsights ? 'Building…' : 'Build Base Insights'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBuildAiInsights}
                        disabled={
                          !aiInsightsEnabled ||
                          !insightBundle ||
                          isBuildingAiInsights ||
                          !latestRun?.runId
                        }
                        title={
                          aiInsightsEnabled
                            ? insightBundle
                              ? undefined
                              : 'Build base insights first.'
                            : 'Enable DELIV_AI_INSIGHTS=1 and provide an API key to use AI insights.'
                        }
                      >
                        {isBuildingAiInsights ? 'Building…' : 'Build AI Insights'}
                      </button>
                      <span
                        className={`deliverables-insights-redaction-indicator ${redactionInfo?.enabled ? 'on' : 'off'}`}
                        title={redactionTooltip}
                      >
                        Redaction {redactionInfo?.enabled === false ? 'Off' : 'On'}
                      </span>
                    </div>
                    {isLoadingInsights ? (
                      <p>Loading insights…</p>
                    ) : !insightBundle ? (
                      <p>No insights available. Build base insights to analyze this run.</p>
                    ) : insightRows.length === 0 ? (
                      <p>No successful artifacts available for insights.</p>
                    ) : (
                      <div className="deliverables-insights-table-wrapper">
                        <table className="deliverables-insights-table">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Course</th>
                              <th>Assignment</th>
                              <th>Pages</th>
                              <th>Words</th>
                              <th>Keywords</th>
                              <th>Warnings</th>
                              <th>AI Summary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insightRows.map(({ base, ai }) => (
                              <tr key={base.artifactId}>
                                <td>
                                  <div className="deliverables-insights-title">
                                    <strong>{base.title ?? 'Untitled artifact'}</strong>
                                    <span className="deliverables-insights-kind">{base.kind.toUpperCase()}</span>
                                    {base.redacted && (
                                      <span className="deliverables-insights-redacted">Redacted</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="deliverables-insights-correct"
                                    onClick={() => handleOpenInsightCorrection(base.artifactId)}
                                  >
                                    Correct
                                  </button>
                                </td>
                                <td>{base.detectedCourseId ?? '—'}</td>
                                <td>{base.detectedAssignmentId ?? '—'}</td>
                                <td>
                                  {typeof base.pageCount === 'number'
                                    ? base.pageCount
                                    : '—'}
                                </td>
                                <td>
                                  {typeof base.wordCount === 'number'
                                    ? base.wordCount.toLocaleString()
                                    : '—'}
                                </td>
                                <td>{base.keywords?.length ? base.keywords.join(', ') : '—'}</td>
                                <td>
                                  {base.warnings?.length ? (
                                    <div className="deliverables-insights-warnings">
                                      {base.warnings.map((warning) => (
                                        <span key={warning} className="deliverables-insights-warning">
                                          {warning}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>
                                <td>
                                  {ai ? (
                                    <div className="deliverables-insights-ai">
                                      {ai.summary ? <p>{ai.summary}</p> : <p>Summary unavailable.</p>}
                                      {ai.actionItems?.length ? (
                                        <ul>
                                          {ai.actionItems.map((item) => (
                                            <li key={item}>{item}</li>
                                          ))}
                                        </ul>
                                      ) : null}
                                      <div className="deliverables-insights-ai-meta">
                                        {typeof ai.confidence === 'number' && (
                                          <span>Confidence: {(ai.confidence * 100).toFixed(0)}%</span>
                                        )}
                                        {ai.model && <span>Model: {ai.model}</span>}
                                      </div>
                                      <div className="deliverables-insights-ai-actions">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCopyInsightText(ai.summary ?? '', 'Insight summary')
                                          }
                                          disabled={!ai.summary}
                                        >
                                          Copy Summary
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCopyInsightText(
                                              ai.actionItems?.join('\n') ?? '',
                                              'Insight action items'
                                            )
                                          }
                                          disabled={!(ai.actionItems && ai.actionItems.length > 0)}
                                        >
                                          Copy Action Items
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p>No AI insight generated.</p>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {!isLoadingSummary && !latestSummary && <p>No summary available for this run.</p>}
        </section>
      )}

      {latestResults.length > 0 && (
        <section className="deliverables-latest">
          <h3>Latest Run ({latestRun?.runId})</h3>
          {localActionMessage && (
            <p className="deliverables-local-message" role="status">
              {localActionMessage}
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Artifact ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Adapter</th>
                <th>Attempts</th>
                <th>Tried</th>
                <th>Success</th>
                <th>Message</th>
                <th>Post</th>
                <th>Output Path</th>
                <th className="deliverables-local-header">
                  <div className="deliverables-local-controls">
                    <label className="deliverables-local-select-all">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(event) => handleSelectAll(event.target.checked)}
                        aria-label="Select all artifacts"
                      />
                      <span>Select all</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleZipSelection}
                      disabled={!hasSelection || !latestRun?.runId || isZippingSelection}
                    >
                      {isZippingSelection ? 'Zipping…' : `Zip selected (${selectedArtifacts.length})`}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {latestResults.map((result) => {
                const attempted = result.attempted ?? [];
                const fallbackUsed = attempted.length > 1;
                const attemptsContent =
                  typeof result.attempts === 'number' ? (
                    <>
                      {result.attempts}
                      <div className="deliverables-transient-info">
                        {result.transientFailureCodes?.length
                          ? `Transient: ${result.transientFailureCodes.join(', ')}`
                          : 'No transient errors'}
                      </div>
                    </>
                  ) : (
                    '—'
                  );
                const badge = (result.badge ?? (result.success ? 'success' : 'error')) as string;
                const normalizedBadge = ['success', 'warning', 'error', 'cancelled', 'skipped'].includes(
                  badge
                )
                  ? badge
                  : 'unknown';
                const badgeLabel = `${normalizedBadge.charAt(0).toUpperCase()}${normalizedBadge.slice(1)}`;

                const postEntry = postByArtifact.get(result.id);
                const postHasActions = (postEntry?.outputs.length ?? 0) > 0;
                const postHasError = postEntry?.outputs.some((output) => !output.ok) ?? false;
                const postSummaryLabel = postEntry
                  ? postEntry.appliedRuleIds.length > 0
                    ? `Rules: ${postEntry.appliedRuleIds.join(', ')}`
                    : 'No rules applied'
                  : latestRun?.post
                    ? 'Not processed'
                    : '—';
                const hasOutput = Boolean(result.outputPath);

                return (
                  <tr key={result.id}>
                    <td>{result.id}</td>
                    <td>{result.type ?? 'unknown'}</td>
                    <td>
                      <span className={`deliverables-badge deliverables-badge--${normalizedBadge}`}>
                        {badgeLabel}
                      </span>
                    </td>
                    <td>
                      <span>{result.adapterId ?? '—'}</span>
                      {fallbackUsed && (
                        <span
                          className="deliverables-fallback-warning"
                          role="img"
                          aria-label="Fallback used"
                          title="Primary adapter failed, used fallback."
                        >
                          ⚠️
                        </span>
                      )}
                      {result.adapterReason && (
                        <div className="deliverables-adapter-reason">{result.adapterReason}</div>
                      )}
                    </td>
                    <td>{attemptsContent}</td>
                    <td>{attempted.length > 0 ? attempted.join(' → ') : '—'}</td>
                    <td>{result.success ? 'Yes' : 'No'}</td>
                    <td>
                      <span title={result.message ?? undefined}>{result.message ?? '—'}</span>
                      {!result.success && typeof result.attempts === 'number' && result.attempts > 1 && (
                        <div className="deliverables-retry-info">
                          Retried {result.attempts - 1} time(s) before failing.
                        </div>
                      )}
                    </td>
                    <td className="deliverables-post-cell">
                      <div className={`deliverables-post-summary ${postHasError ? 'error' : 'ok'}`}>
                        {postSummaryLabel}
                      </div>
                      {postEntry && postHasActions ? (
                        <details>
                          <summary>Actions ({postEntry.outputs.length})</summary>
                          <ul>
                            {postEntry.outputs.map((output, index) => (
                              <li
                                key={`${result.id}-post-${index}`}
                                className={`deliverables-post-detail ${output.ok ? 'ok' : 'error'}`}
                              >
                                <span className="deliverables-post-action">{output.action}</span>
                                <span className="deliverables-post-path">
                                  {output.to ? `${output.from} → ${output.to}` : output.from}
                                </span>
                                {output.message && <span className="deliverables-post-message"> — {output.message}</span>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : postEntry ? (
                        <div className="deliverables-post-noop">No post-processing actions.</div>
                    ) : latestRun?.post ? (
                      <div className="deliverables-post-noop">Not processed.</div>
                    ) : null}
                  </td>
                  <td>{result.outputPath ?? '—'}</td>
                  <td className="deliverables-local-cell">
                    <div className="deliverables-local-actions">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(result.id)}
                        onChange={() => handleToggleSelection(result.id)}
                        aria-label={`Select ${result.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRevealOutput(result.outputPath)}
                        disabled={!hasOutput}
                      >
                        Reveal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenOutput(result.outputPath)}
                        disabled={!hasOutput}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTrashOutput(result.outputPath)}
                        disabled={!hasOutput}
                      >
                        Trash
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      )}

      <section className="deliverables-storage">
        <h3>Storage</h3>
        {storagePaths ? (
          <ul className="deliverables-storage-paths">
            <li>
              <strong>User data:</strong> {storagePaths.userData}
            </li>
            <li>
              <strong>Outputs:</strong> {storagePaths.outputs}
            </li>
            <li>
              <strong>Archives:</strong> {storagePaths.archives}
            </li>
          </ul>
        ) : (
          <p>Run the pipeline to capture local storage locations.</p>
        )}
        <div className="deliverables-storage-actions">
          <button
            type="button"
            onClick={handleArchiveRun}
            disabled={!latestRun?.runId || isArchiving}
          >
            {isArchiving ? 'Archiving…' : 'Archive this run'}
          </button>
          <button type="button" onClick={handleRetentionDryRun} disabled={isRunningRetention}>
            Retention dry run
          </button>
          <button type="button" onClick={handleRetentionApply} disabled={isRunningRetention}>
            Apply retention
          </button>
        </div>
        <div className="deliverables-storage-metrics">
          <span>
            Total runs known: {history.length > 0 ? history.length : latestRun ? 1 : 0}
          </span>
        </div>
        {retentionPlan && (
          <details className="deliverables-retention-plan" open>
            <summary>
              Retention results — removed {retentionPlan.removed.length}, kept {retentionPlan.kept.length},
              errors {retentionPlan.errors.length}
            </summary>
            <div className="deliverables-retention-columns">
              <div>
                <h4>Removed</h4>
                {retentionPlan.removed.length === 0 ? (
                  <p>No removals.</p>
                ) : (
                  <ul>
                    {retentionPlan.removed.map((entry) => (
                      <li key={`removed-${entry}`}>{entry}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4>Errors</h4>
                {retentionPlan.errors.length === 0 ? (
                  <p>No errors.</p>
                ) : (
                  <ul>
                    {retentionPlan.errors.map((entry) => (
                      <li key={`error-${entry.path}`}>
                        <strong>{entry.path}:</strong> {entry.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        )}
      </section>

      {!IS_PRODUCTION && history.length > 0 && (
        <section className="deliverables-history">
          <h3>Recent Runs</h3>
          <ul>
            {history.map((run) => (
              <li key={run.runId}>
                <strong>{run.runId}</strong> — {new Date(run.startedAt).toLocaleString()} —{' '}
                {run.results.filter((result) => result.success).length}/{run.results.length} success
              </li>
            ))}
          </ul>
        </section>
      )}
      {insightCorrection && (
        <div className="deliverables-modal" role="dialog" aria-modal="true">
          <div className="deliverables-modal-content">
            <h4>Correct Insight</h4>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveInsightCorrection();
              }}
            >
              <label>
                <span>Title</span>
                <input
                  type="text"
                  value={insightCorrection.title}
                  onChange={(event) => handleInsightCorrectionChange('title', event.target.value)}
                />
              </label>
              <label>
                <span>Course</span>
                <input
                  type="text"
                  value={insightCorrection.detectedCourseId}
                  onChange={(event) =>
                    handleInsightCorrectionChange('detectedCourseId', event.target.value)
                  }
                />
              </label>
              <label>
                <span>Assignment</span>
                <input
                  type="text"
                  value={insightCorrection.detectedAssignmentId}
                  onChange={(event) =>
                    handleInsightCorrectionChange('detectedAssignmentId', event.target.value)
                  }
                />
              </label>
              <div className="deliverables-modal-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={handleCancelInsightCorrection}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliverablesView;
