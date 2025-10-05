import { getDeliverablesConfig } from './config';
import type { DeliverableRunRecord, RunSummary, AiSummaryPayload } from './types';
import { LLM_TEXT_MODEL, withAiTags, assertAiMetadata } from '../../src/shared/aiConfig';
import { getPromptTemplate, renderPromptTemplate } from '../prompts/loader';

function isEnabled(): boolean {
  return getDeliverablesConfig().featureFlags.aiSummary;
}

function resolveApiKey(): string | null {
  return getDeliverablesConfig().ai.openAiApiKey;
}

function buildPrompt(run: DeliverableRunRecord, summary: RunSummary): string {
  const condensedResults = Array.isArray(run.results)
    ? run.results.slice(0, 20).map((result) => ({
        id: result?.id,
        badge: result?.badge ?? (result?.success ? 'success' : 'error'),
        adapterId: result?.adapterId,
        message: result?.message,
        errors: Array.isArray(result?.errors)
          ? result.errors.map((error) => error?.code).filter(Boolean)
          : []
      }))
    : [];

  return renderPromptTemplate('ai-summary.user', {
    RUN_ID: summary.runId,
    TIMELINE: `Started ${new Date(summary.startedAt).toISOString()}, finished ${new Date(summary.finishedAt).toISOString()}, duration ${summary.durationMs}ms.`,
    TOTALS: JSON.stringify(summary.totals),
    BY_TYPE: JSON.stringify(summary.byType),
    FALLBACK_COUNT: summary.fallbackCount,
    HIGHLIGHTS: summary.bullets.join(' | '),
    RESULTS_SAMPLE: JSON.stringify(condensedResults)
  });
}

export async function buildAiSummary(
  run: DeliverableRunRecord,
  base: RunSummary
): Promise<AiSummaryPayload | null> {
  try {
    if (!isEnabled()) {
      return null;
    }

    assertAiMetadata();
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return null;
    }

    if (typeof fetch !== 'function') {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getDeliverablesConfig().timeouts.aiSummaryMs);

    try {
      const prompt = buildPrompt(run, base);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: LLM_TEXT_MODEL,
          temperature: 0.2,
          max_tokens: 250,
          messages: [
            { role: 'system', content: getPromptTemplate('ai-summary.system') },
            { role: 'user', content: prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        const model = typeof data?.model === 'string' ? data.model : LLM_TEXT_MODEL;
        return withAiTags({
          content: content.trim(),
          model,
          createdAt: new Date().toISOString()
        });
      }

      return null;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return null;
  }
}
