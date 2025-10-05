import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getRun } from '../dataStore';
import type { DeliverableRunRecord, ArtifactKind, DeliverableJobResult } from '../types';
import { computeKeywords, countWords, parseArtifact } from './parsers';
import {
  getAiInsightsTimeoutMs,
  getOpenAiApiKey,
  isAiInsightsEnabled,
  isRedactionEnabled
} from './config';
import { getRedactionPatterns, maybeRedactText } from './redact';
import type { AiInsight, BaseInsight, InsightBundle } from './types';
import {
  LLM_TEXT_MODEL,
  assertAiMetadata,
  withAiTags
} from '../../../src/shared/aiConfig';
import { getPromptTemplate, renderPromptTemplate } from '../../prompts/loader';

const INSIGHTS_VERSION = 1;

const runCache = new Map<string, DeliverableRunRecord>();

function inferKindFromPath(filePath: string | undefined): ArtifactKind | undefined {
  if (!filePath) {
    return undefined;
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return 'pdf';
  }
  if (ext === '.docx') {
    return 'docx';
  }
  if (ext === '.html' || ext === '.htm') {
    return 'html';
  }
  return undefined;
}

function getInsightsDir(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'insights');
}

function getBundlePath(runId: string): string {
  return path.join(getInsightsDir(), `${runId}.json`);
}

async function ensureInsightsDir(): Promise<void> {
  const dir = getInsightsDir();
  await fs.mkdir(dir, { recursive: true });
}

async function writeAtomic(filePath: string, payload: string): Promise<void> {
  await ensureInsightsDir();
  const dir = path.dirname(filePath);
  const tempName = `${path.basename(filePath)}.${randomUUID()}.tmp`;
  const tempPath = path.join(dir, tempName);
  await fs.writeFile(tempPath, payload, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function loadInsightBundle(runId: string): Promise<InsightBundle | null> {
  if (!runId) {
    return null;
  }
  try {
    const filePath = getBundlePath(runId);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as InsightBundle;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('[deliverables:insights] Failed to load bundle', error);
    return null;
  }
}

async function saveInsightBundle(bundle: InsightBundle): Promise<void> {
  const payload = JSON.stringify(bundle, null, 2);
  const filePath = getBundlePath(bundle.runId);
  await writeAtomic(filePath, payload);
}

function mergeWarnings(...sources: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of sources) {
    if (!list) continue;
    for (const entry of list) {
      if (!entry) continue;
      if (!seen.has(entry)) {
        merged.push(entry);
        seen.add(entry);
      }
    }
  }
  return merged;
}

function normalizePatchValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildBaseInsightSkeleton(result: DeliverableJobResult): BaseInsight {
  const kind = (result.type ?? inferKindFromPath(result.outputPath) ?? 'html') as ArtifactKind;
  return {
    artifactId: result.id,
    kind,
    warnings: [],
    redacted: false
  };
}

export async function buildBaseInsights(
  run: DeliverableRunRecord,
  opts?: { limit?: number }
): Promise<InsightBundle> {
  const limit = typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : undefined;
  const base: Record<string, BaseInsight> = {};
  let processed = 0;

  for (const result of run.results) {
    if (!result.success || !result.id) {
      continue;
    }
    if (limit && processed >= limit) {
      break;
    }
    processed += 1;

    const insight = buildBaseInsightSkeleton(result);
    const warnings: string[] = [];

    const outputPath = result.outputPath;
    if (!outputPath) {
      warnings.push('Missing output path');
      insight.warnings = warnings;
      base[result.id] = insight;
      continue;
    }

    const kind = (result.type ?? inferKindFromPath(outputPath)) as ArtifactKind | undefined;
    if (!kind) {
      warnings.push('Unknown artifact type');
      insight.warnings = warnings;
      base[result.id] = insight;
      continue;
    }
    insight.kind = kind;

    try {
      const parsed = await parseArtifact(outputPath, kind);
      let workingText = parsed.text;
      let wasRedacted = false;
      if (workingText) {
        const redaction = maybeRedactText(workingText);
        workingText = redaction.text;
        wasRedacted = redaction.redacted;
      }

      const wordCount = countWords(workingText);
      const keywords = computeKeywords(workingText);

      insight.title = parsed.title ?? insight.title;
      insight.author = parsed.author ?? insight.author;
      insight.detectedCourseId = parsed.detectedCourseId;
      insight.detectedAssignmentId = parsed.detectedAssignmentId;
      insight.pageCount = parsed.pageCount;
      insight.wordCount = wordCount;
      insight.keywords = keywords;
      insight.redacted = wasRedacted && isRedactionEnabled();
      insight.warnings = mergeWarnings(warnings, parsed.warnings);
    } catch (error) {
      console.error('[deliverables:insights] Failed to parse artifact', error);
      warnings.push('Parser error');
      insight.warnings = mergeWarnings(warnings);
    }

    base[result.id] = insight;
  }

  const bundle: InsightBundle = {
    runId: run.runId,
    createdAt: Date.now(),
    base,
    version: INSIGHTS_VERSION
  };

  await saveInsightBundle(bundle);
  runCache.set(run.runId, run);
  return bundle;
}

function clampConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildAiPrompt(base: BaseInsight, excerpt: string, redactionEnabled: boolean): string {
  return renderPromptTemplate('insights.user', {
    ARTIFACT_ID: base.artifactId,
    TITLE: base.title ?? 'Unknown',
    COURSE_GUESS: base.detectedCourseId ?? '',
    ASSIGNMENT_GUESS: base.detectedAssignmentId ?? '',
    KEYWORDS: (base.keywords ?? []).join(', '),
    WARNINGS: (base.warnings ?? []).join(', '),
    REDACTION_STATE: redactionEnabled ? 'masked' : 'off',
    EXCERPT: excerpt || '[unavailable]'
  });
}

async function requestAiInsight(
  base: BaseInsight,
  excerpt: string,
  signal: AbortSignal
): Promise<AiInsight | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return null;
  }
  if (typeof fetch !== 'function') {
    console.warn('[deliverables:insights] fetch is not available for AI insights');
    return null;
  }

  assertAiMetadata();
  const prompt = buildAiPrompt(base, excerpt, isRedactionEnabled());
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: LLM_TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: getPromptTemplate('insights.system')
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal
    });

    if (!response.ok) {
      console.warn('[deliverables:insights] AI request failed', response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.warn('[deliverables:insights] Failed to parse AI response', error);
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const summaryRaw = (parsed as { summary?: unknown }).summary;
    const summary = typeof summaryRaw === 'string' ? summaryRaw.slice(0, 1200).trim() : undefined;

    const itemsRaw = (parsed as { actionItems?: unknown }).actionItems;
    const actionItems = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0)
          .slice(0, 10)
      : undefined;

    const confidence = clampConfidence((parsed as { confidence?: unknown }).confidence);

    const insight: AiInsight = withAiTags({
      artifactId: base.artifactId,
      summary,
      actionItems,
      confidence,
      model: typeof payload.model === 'string' ? payload.model : LLM_TEXT_MODEL
    });

    return insight;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('[deliverables:insights] AI request aborted due to timeout');
      return null;
    }
    console.error('[deliverables:insights] AI request error', error);
    return null;
  }
}

async function parseExcerpt(
  result: DeliverableJobResult,
  kind: ArtifactKind
): Promise<string> {
  if (!result.outputPath) {
    return '';
  }
  try {
    const parsed = await parseArtifact(result.outputPath, kind);
    if (!parsed.text) {
      return '';
    }
    const redacted = maybeRedactText(parsed.text);
    return redacted.text ? redacted.text.slice(0, 1024) : '';
  } catch (error) {
    console.error('[deliverables:insights] Failed to parse excerpt', error);
    return '';
  }
}

export async function buildAiInsights(
  runId: string,
  bundle: InsightBundle
): Promise<InsightBundle> {
  if (!isAiInsightsEnabled() || !getOpenAiApiKey()) {
    return bundle;
  }
  let run = runCache.get(runId);
  if (!run) {
    const fetched = await getRun(runId);
    if (fetched) {
      runCache.set(runId, fetched);
      run = fetched;
    }
  }
  if (!run) {
    return bundle;
  }

  const timeout = getAiInsightsTimeoutMs();
  const aiResults: Record<string, AiInsight> = { ...(bundle.ai ?? {}) };

  for (const base of Object.values(bundle.base)) {
    const matching = run.results.find((entry) => entry.id === base.artifactId && entry.success);
    if (!matching || !matching.outputPath) {
      continue;
    }
    const kind = (matching.type ?? inferKindFromPath(matching.outputPath)) as ArtifactKind | undefined;
    if (!kind) {
      continue;
    }

    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<AiInsight | null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, timeout);
    });

    try {
      const excerpt = await parseExcerpt(matching, kind);
      const aiPromise = requestAiInsight(base, excerpt, controller.signal);
      const insight = await Promise.race([aiPromise, timeoutPromise]);
      if (insight) {
        aiResults[base.artifactId] = insight;
      }
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  if (Object.keys(aiResults).length > 0) {
    bundle.ai = aiResults;
    await saveInsightBundle(bundle);
  }

  return bundle;
}

export async function saveInsightCorrection(
  runId: string,
  artifactId: string,
  patch: Partial<Pick<BaseInsight, 'title' | 'detectedCourseId' | 'detectedAssignmentId'>>
): Promise<InsightBundle | null> {
  const bundle = await loadInsightBundle(runId);
  if (!bundle) {
    return null;
  }
  const target = bundle.base[artifactId];
  if (!target) {
    return bundle;
  }

  const updates: Partial<BaseInsight> = {};
  if ('title' in patch) {
    updates.title = normalizePatchValue(patch.title);
  }
  if ('detectedCourseId' in patch) {
    updates.detectedCourseId = normalizePatchValue(patch.detectedCourseId);
  }
  if ('detectedAssignmentId' in patch) {
    updates.detectedAssignmentId = normalizePatchValue(patch.detectedAssignmentId);
  }

  bundle.base[artifactId] = {
    ...target,
    ...updates
  };

  await saveInsightBundle(bundle);
  return bundle;
}

export function isAiInsightsAvailable(): boolean {
  return isAiInsightsEnabled() && Boolean(getOpenAiApiKey());
}

export function getRedactionInfo(): { enabled: boolean; patterns: string[] } {
  return { enabled: isRedactionEnabled(), patterns: getRedactionPatterns() };
}

export { INSIGHTS_VERSION };
