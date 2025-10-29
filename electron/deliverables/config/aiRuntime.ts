export interface AiRuntimeConfig {
  modelGeneration: string;
  promptPackVersion: string;
  textModel: string;
  chatModel: string;
  embeddingsModel: string;
  badgeLabel: string;
  regenerationBanner: string;
}

const aiRuntimeConfig: AiRuntimeConfig = {
  modelGeneration: 'v2025-10-04',
  promptPackVersion: 'v2025-10-04',
  textModel: 'gpt-5-codex',
  chatModel: 'gpt-5-codex-chat',
  embeddingsModel: 'text-embedding-5-large',
  badgeLabel: 'AI v2025-10-04 active.',
  regenerationBanner: 'AI is regenerating. Please wait until green.'
};

export function getAiRuntimeConfig(): AiRuntimeConfig {
  return aiRuntimeConfig;
}

export function assertAiRuntimeReady(): void {
  if (!aiRuntimeConfig.modelGeneration || !aiRuntimeConfig.promptPackVersion) {
    throw new Error('[ai-runtime] Missing model generation or prompt pack configuration.');
  }
}
