import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { run as validateArtifact } from './jobs/validateArtifact';
import { saveRun, saveSummary } from './dataStore';
import { appendLog } from './logStore';
import type {
  ArtifactInput,
  DeliverableJobResult,
  DeliverableRunRecord,
  ArtifactKind,
  BadgeKind
} from './types';
import type { RendererAdapter } from './renderers/adapter';
import {
  getAdapterSelection,
  register as registerAdapter
} from './renderers/registry';
import copyPdfAdapter from './renderers/copyPdf';
import copyDocxAdapter from './renderers/copyDocx';
import staticHtmlAdapter from './renderers/staticHtml';
import { withRetry } from './utils/retry';
import { assertBudgetAvailable, BudgetExceededError } from '../guards/budgetGate';
import puppeteerHtmlAdapter from './renderers/puppeteerHtml';
import qpdfPdfAdapter from './renderers/qpdfPdf';
import libreofficeDocxAdapter from './renderers/libreofficeDocx';
import { buildRunSummary } from './summary';
import { zipRun } from './archive';
import { isAutoArchiveEnabled } from './config';
import { getRules } from './postprocess/config';
import { applyActions, matchRule } from './postprocess/engine';
import type { CourseContext, PostResult } from './postprocess/types';

registerAdapter(staticHtmlAdapter);
registerAdapter(copyPdfAdapter);
registerAdapter(copyDocxAdapter);
registerAdapter(puppeteerHtmlAdapter);
registerAdapter(qpdfPdfAdapter);
registerAdapter(libreofficeDocxAdapter);

function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  try {
    return randomUUID();
  } catch {
    return `run-${Date.now()}`;
  }
}

async function ensureRunDirectory(runId: string): Promise<string> {
  const runDir = path.join(app.getPath('userData'), 'deliverables', 'outputs', runId);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

type AnnotatedResult = DeliverableJobResult & { type: ArtifactKind };

function includesAbortToken(input: string | undefined): boolean {
  if (!input) {
    return false;
  }
  return input.toLowerCase().includes('abort');
}

function determineBadge(result: AnnotatedResult): BadgeKind {
  if (result.success) {
    return 'success';
  }

  if (
    includesAbortToken(result.message) ||
    includesAbortToken(result.adapterReason) ||
    (result.errors ?? []).some((error) => includesAbortToken(error.details))
  ) {
    return 'cancelled';
  }

  const reason = result.adapterReason?.toLowerCase() ?? '';
  const message = result.message?.toLowerCase() ?? '';
  if (
    reason.includes('validation failed prior') ||
    message.startsWith('validation failed')
  ) {
    return 'skipped';
  }

  return 'error';
}

function annotateResult(result: DeliverableJobResult, type: ArtifactKind): AnnotatedResult {
  const annotated = { ...result, type } as AnnotatedResult;
  const badge = determineBadge(annotated);
  return { ...annotated, badge };
}

export { determineBadge as __determineBadgeForTest };

type AdapterRunOutcome = {
  result: DeliverableJobResult;
  attempts: number;
  transientFailureCodes: string[];
};

async function runAdapterWithRetry({
  adapter,
  artifact,
  outDir,
  signal,
  dryRun,
  reason
}: {
  adapter: RendererAdapter;
  artifact: ArtifactInput;
  outDir: string;
  signal: AbortSignal;
  dryRun: boolean;
  reason: string;
}): Promise<AdapterRunOutcome> {
  const transientFailures: Array<{ attempt: number; code: string; message?: string }> = [];
  let attempts = 0;
  let lastResult: DeliverableJobResult | null = null;

  try {
    const result = await withRetry(
      async () => {
        attempts += 1;
        const adapterResult = await adapter.render({
          artifact,
          outDir,
          signal,
          dryRun
        });
        lastResult = adapterResult;
        if (!adapterResult.success && adapterResult.transientErrorCode) {
          const transient = new Error(
            adapterResult.message ?? 'Transient adapter failure.'
          ) as NodeJS.ErrnoException;
          transient.code = adapterResult.transientErrorCode;
          throw transient;
        }
        return adapterResult;
      },
      {
        onRetry(error, attempt, remaining) {
          const err = error as NodeJS.ErrnoException;
          const code = typeof err?.code === 'string' ? err.code : 'UNKNOWN';
          transientFailures.push({
            attempt,
            code,
            message: err instanceof Error ? err.message : String(error)
          });
          appendLog({
            level: 'warn',
            scope: 'deliverables',
            message: `Transient error on attempt ${attempt} of ${attempt + remaining}`,
            data: {
              adapterId: adapter.id,
              artifactId: artifact.id,
              code
            }
          });
        }
      }
    );

    const transientCodes = transientFailures.map((entry) => entry.code);
    const finalResult: DeliverableJobResult = {
      ...result,
      adapterId: adapter.id,
      adapterReason: reason,
      attempts,
      transientFailureCodes: transientCodes,
      dryRun
    };

    if (finalResult.success && !finalResult.message) {
      finalResult.message = `Adapter ${adapter.id} completed successfully.`;
    }

    if (finalResult.success && attempts > 1) {
      const codes = transientCodes.length ? ` (transient: ${transientCodes.join(', ')})` : '';
      finalResult.message = `Adapter ${adapter.id} succeeded after ${attempts} attempts${codes}.`;
    }

    if (finalResult.success) {
      delete finalResult.transientErrorCode;
    }

    if (!finalResult.success) {
      const failureMessage =
        finalResult.message ?? `Adapter ${adapter.id} failed without additional context.`;
      appendLog({
        level: 'error',
        scope: 'deliverables',
        message: `Permanent failure: ${failureMessage}`,
        data: {
          adapterId: adapter.id,
          artifactId: artifact.id
        }
      });
    }

    return { result: finalResult, attempts, transientFailureCodes: transientCodes };
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : 'Unexpected adapter failure.';
    appendLog({
      level: 'error',
      scope: 'deliverables',
      message: `Permanent failure: ${failureMessage}`,
      data: {
        adapterId: adapter.id,
        artifactId: artifact.id
      }
    });

    const transientCodes = transientFailures.map((entry) => entry.code);

    if (lastResult) {
      const previous = lastResult as DeliverableJobResult;
      const codesSuffix = transientFailures.length
        ? ` (attempts: ${attempts}, transient: ${transientCodes.join(', ')})`
        : attempts > 1
          ? ` (attempts: ${attempts})`
          : '';
      const combinedMessage = `${
        previous.message ?? `Adapter ${adapter.id} failed after ${attempts} attempts.`
      }${codesSuffix}`;
      const failure: DeliverableJobResult = {
        ...previous,
        adapterId: adapter.id,
        adapterReason: reason,
        attempts,
        transientFailureCodes: transientCodes,
        dryRun,
        message: combinedMessage
      };
      return { result: failure, attempts, transientFailureCodes: transientCodes };
    }

    const codesSuffix = transientFailures.length
      ? ` (attempts: ${attempts}, transient: ${transientCodes.join(', ')})`
      : attempts > 1
        ? ` (attempts: ${attempts})`
        : '';

    const failure: DeliverableJobResult = {
      id: artifact.id,
      success: false,
      adapterId: adapter.id,
      adapterReason: reason,
      attempts,
      transientFailureCodes: transientCodes,
      dryRun,
      message: `Adapter ${adapter.id} failed: ${failureMessage}${codesSuffix}`,
      errors: [
        {
          code: 'MISSING_FILE',
          details: failureMessage
        }
      ]
    };

    return { result: failure, attempts, transientFailureCodes: transientCodes };
  }
}

async function processArtifact({
  artifact,
  runDir,
  dryRun
}: {
  artifact: ArtifactInput;
  runDir: string;
  dryRun: boolean;
}): Promise<AnnotatedResult> {
  assertBudgetAvailable('deliverables.pipeline.processArtifact');
  try {
    const validationResult = await validateArtifact(artifact);
    if (!validationResult.success) {
      return annotateResult(
        {
          ...validationResult,
          adapterReason: 'Validation failed prior to rendering.',
          dryRun
        },
        artifact.type
      );
    }

    const selection = await getAdapterSelection(artifact.type);
    const adapter = selection.adapter;
    appendLog({
      level: 'info',
      scope: 'deliverables',
      message: `Using adapter ${adapter.id} for ${artifact.id}`,
      data: {
        adapterId: adapter.id,
        artifactId: artifact.id,
        reason: selection.reason,
        dryRun
      }
    });

    const controller = new AbortController();
    const attemptedAdapters: string[] = [];
    let totalAttempts = 0;
    const aggregatedTransient: string[] = [];

    const primaryOutcome = await runAdapterWithRetry({
      adapter,
      artifact,
      outDir: runDir,
      signal: controller.signal,
      dryRun,
      reason: selection.reason
    });

    attemptedAdapters.push(adapter.id);
    totalAttempts += primaryOutcome.attempts;
    aggregatedTransient.push(...primaryOutcome.transientFailureCodes);

    let finalResult = primaryOutcome.result;

    if (
      !finalResult.success &&
      !selection.usedFallback &&
      selection.fallbackAdapter &&
      selection.fallbackAdapter.id !== adapter.id &&
      !controller.signal.aborted
    ) {
      appendLog({
        level: 'warn',
        scope: 'deliverables',
        message: `Primary adapter ${adapter.id} failed for ${artifact.id}; invoking fallback ${selection.fallbackAdapter.id}.`,
        data: {
          artifactId: artifact.id,
          primaryAdapterId: adapter.id,
          fallbackAdapterId: selection.fallbackAdapter.id,
          primaryMessage: finalResult.message
        }
      });

      const fallbackOutcome = await runAdapterWithRetry({
        adapter: selection.fallbackAdapter,
        artifact,
        outDir: runDir,
        signal: controller.signal,
        dryRun,
        reason: 'Fallback adapter invoked after primary failure.'
      });

      attemptedAdapters.push(selection.fallbackAdapter.id);
      totalAttempts += fallbackOutcome.attempts;
      aggregatedTransient.push(...fallbackOutcome.transientFailureCodes);

      const primaryMessage = finalResult.message ?? 'No additional context.';
      const fallbackMessage = fallbackOutcome.result.message ?? 'No additional context.';

      if (fallbackOutcome.result.success) {
        finalResult = {
          ...fallbackOutcome.result,
          message: `Primary adapter ${adapter.id} failed (${primaryMessage}). Fallback ${selection.fallbackAdapter.id} succeeded (${fallbackMessage}).`
        };
        appendLog({
          level: 'info',
          scope: 'deliverables',
          message: `Fallback adapter ${selection.fallbackAdapter.id} succeeded for ${artifact.id}.`,
          data: {
            artifactId: artifact.id,
            primaryAdapterId: adapter.id,
            fallbackAdapterId: selection.fallbackAdapter.id
          }
        });
      } else {
        finalResult = {
          ...fallbackOutcome.result,
          message: `Primary adapter ${adapter.id} failed (${primaryMessage}). Fallback ${selection.fallbackAdapter.id} also failed (${fallbackMessage}).`
        };
      }

      finalResult.adapterReason = 'Fallback adapter executed after primary failure.';
    }

    const dedupedTransient = Array.from(
      new Set(aggregatedTransient.filter((code): code is string => Boolean(code)))
    );

    finalResult.attempted = attemptedAdapters;
    finalResult.attempts = totalAttempts;
    finalResult.transientFailureCodes = dedupedTransient;
    finalResult.dryRun = dryRun;

    return annotateResult(finalResult, artifact.type);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unexpected pipeline error.';
    return annotateResult(
      {
        id: artifact.id,
        success: false,
        message,
        dryRun,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ]
      },
      artifact.type
    );
  }
}

export async function runDeliverablePipeline(
  artifacts: ArtifactInput[] = [],
  options?: {
    concurrency?: number;
    dryRun?: boolean;
    post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext };
  }
): Promise<{ success: boolean; run: DeliverableRunRecord }> {
  assertBudgetAvailable('deliverables.pipeline.start');
  const runId = createRunId();
  const startedAt = Date.now();
  const dryRun = Boolean(options?.dryRun);
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  const results: AnnotatedResult[] = new Array(artifacts.length);
  const postOptions = options?.post;
  const postEnabled = Boolean(postOptions?.enable);
  const postDryRun = Boolean(postOptions?.dryRun ?? dryRun);
  const courseContext: CourseContext = postOptions?.ctx
    ? {
        courseId: postOptions.ctx.courseId,
        courseName: postOptions.ctx.courseName,
        assignmentId: postOptions.ctx.assignmentId,
        dueDateIso: postOptions.ctx.dueDateIso,
        meta:
          postOptions.ctx.meta && typeof postOptions.ctx.meta === 'object'
            ? { ...postOptions.ctx.meta }
            : undefined
      }
    : {};
  const hasCourseContext = Boolean(
    courseContext.courseId ||
      courseContext.courseName ||
      courseContext.assignmentId ||
      courseContext.dueDateIso ||
      (courseContext.meta && Object.keys(courseContext.meta).length > 0)
  );

  let runDir: string | null = null;
  if (artifacts.length > 0) {
    runDir = await ensureRunDirectory(runId);
  }

  let index = 0;
  async function worker(): Promise<void> {
    while (index < artifacts.length) {
      assertBudgetAvailable('deliverables.pipeline.worker');
      const currentIndex = index;
      index += 1;
      const artifact = artifacts[currentIndex];
      const outputDir = runDir ?? (await ensureRunDirectory(runId));
      results[currentIndex] = await processArtifact({
        artifact,
        runDir: outputDir,
        dryRun
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, artifacts.length || 1) }, () => worker());
  try {
    await Promise.all(workers);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      throw error;
    }
    throw error;
  }

  let postSummary: { success: boolean; results: PostResult[]; ctx?: CourseContext; dryRun?: boolean } | undefined;

  if (postEnabled) {
    try {
      const rules = await getRules();
      const timestamp = new Date().toISOString();
      const postResults: PostResult[] = [];
      let postSuccess = true;

      for (const result of results) {
        if (!result?.success) {
          postResults.push({ artifactId: result.id, appliedRuleIds: [], outputs: [] });
          continue;
        }

        const matchingRules = rules.filter((rule) => matchRule(result, courseContext, rule));
        if (matchingRules.length === 0) {
          postResults.push({ artifactId: result.id, appliedRuleIds: [], outputs: [] });
          continue;
        }

        const aggregatedActions = matchingRules.flatMap((rule) => rule.actions ?? []);
        const postResult = await applyActions(result, courseContext, aggregatedActions, {
          dryRun: postDryRun,
          ruleIds: matchingRules.map((rule) => rule.id),
          runId,
          timestamp
        });

        if (!postResult.outputs.every((entry) => entry.ok)) {
          postSuccess = false;
        }

        if (!postDryRun) {
          const latest = [...postResult.outputs].reverse().find((entry) => entry.ok && entry.to);
          if (latest?.to) {
            result.outputPath = latest.to;
          }
        }

        postResults.push(postResult);
      }

      postSummary = {
        success: postSuccess,
        results: postResults,
        ctx: hasCourseContext ? courseContext : undefined,
        dryRun: postDryRun
      };
    } catch (error) {
      console.error('[deliverables:pipeline] Post-processing failure', error);
      postSummary = {
        success: false,
        results: results.map((result) => ({
          artifactId: result.id,
          appliedRuleIds: [],
          outputs: []
        })),
        ctx: hasCourseContext ? courseContext : undefined,
        dryRun: postDryRun
      };
    }
  }

  const finishedAt = Date.now();
  const run: DeliverableRunRecord = {
    runId,
    startedAt,
    finishedAt,
    results: results as DeliverableJobResult[],
    options: {
      dryRun,
      concurrency,
      post: postOptions
        ? {
            enable: postEnabled,
            dryRun: postDryRun
          }
        : undefined
    },
    post: postSummary
  };

  try {
    await saveRun(run);
  } catch (error) {
    console.error('[deliverables:pipeline] Failed to persist run record', error);
  }

  try {
    const summary = buildRunSummary(run);
    await saveSummary(runId, summary);
  } catch (error) {
    console.error('[deliverables:pipeline] Failed to persist run summary', error);
  }

  const pipelineSuccess = results.every((result) => result.success);
  if (pipelineSuccess && isAutoArchiveEnabled()) {
    zipRun(runId).then((outcome) => {
      if (!outcome.ok) {
        console.error(
          '[deliverables:pipeline] Auto archive failed',
          outcome.message ?? 'Unknown archive error'
        );
      }
    }).catch((error) => {
      console.error('[deliverables:pipeline] Auto archive unexpected error', error);
    });
  }

  return {
    success: pipelineSuccess,
    run
  };
}
