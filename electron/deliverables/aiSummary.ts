import type { AiSummaryPayload, DeliverableRunRecord, RunSummary } from './types';
import { getDeliverablesConfig } from './config';
import { assertAiMetadata, withAiTags } from '../../src/shared/aiConfig';
import { assertAiRuntimeReady, getAiRuntimeConfig } from './config/aiRuntime';
import { getPromptPack } from './prompts';

function isEnabled(): boolean {
  return getDeliverablesConfig().featureFlags.aiSummary;
}

function resolveApiKey(): string | null {
  return getDeliverablesConfig().ai.openAiApiKey;
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const value = context[key];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  });
}

function buildPrompt(run: DeliverableRunRecord, summary: RunSummary): { system: string; user: string } {
  const promptPack = getPromptPack();
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

  const context = {
    runId: summary.runId,
    startedAtIso: new Date(summary.startedAt).toISOString(),
    finishedAtIso: new Date(summary.finishedAt).toISOString(),
    durationMs: summary.durationMs,
    totalsJson: summary.totals,
    byTypeJson: summary.byType,
    fallbackCount: summary.fallbackCount,
    highlightsJson: summary.bullets,
    resultsJson: condensedResults
  } as Record<string, unknown>;

  return {
    system: promptPack.aiSummary.system,
    user: renderTemplate(promptPack.aiSummary.user, context)
  };
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
    assertAiRuntimeReady();
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return null;
    }

    const runtime = getAiRuntimeConfig();
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
          model: runtime.chatModel,
          temperature: 0.2,
          max_tokens: 250,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
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
        const model = typeof data?.model === 'string' ? data.model : runtime.chatModel;
        return withAiTags({
          content: content.trim(),
          model,
          createdAt: new Date().toISOString()
        });
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
