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

export function getModelGeneration(): string {
  return getDeliverablesConfig().ai.modelGeneration;
}

export function getPromptPackVersion(): string {
  return getDeliverablesConfig().ai.promptPackVersion;
}

export function getEmbeddingsModel(): string {
  return getDeliverablesConfig().ai.embeddingsModel;
}

export function getAiBadgeLabel(): string {
  return getDeliverablesConfig().ai.badgeLabel;
}

export function getRegenerationBanner(): string {
  return getDeliverablesConfig().ai.regenerationBanner;
}
