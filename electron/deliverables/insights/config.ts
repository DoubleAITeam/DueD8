import { getDeliverablesConfig } from '../config';

export function getInsightsMaxPages(): number {
  return getDeliverablesConfig().insights.maxPages;
}

export function getInsightsMaxBytesMb(): number {
  return getDeliverablesConfig().insights.maxBytesMb;
}

export function getInsightsMaxBytes(): number {
  return getDeliverablesConfig().insights.maxBytes;
}

export function isAiInsightsEnabled(): boolean {
  return getDeliverablesConfig().featureFlags.aiInsights;
}

export function getAiInsightsTimeoutMs(): number {
  return getDeliverablesConfig().insights.aiTimeoutMs;
}

export function getOpenAiApiKey(): string | undefined {
  return getDeliverablesConfig().ai.openAiApiKey ?? undefined;
}

export function isRedactionEnabled(): boolean {
  return getDeliverablesConfig().insights.redact;
}
