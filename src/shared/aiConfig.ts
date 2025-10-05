export const AI_MODEL_GENERATION = 'v2025-10-04';
export const PROMPT_PACK_VERSION = 'v2025-10-04';
export const LLM_TEXT_MODEL = 'gpt-5-codex';
export const LLM_CHAT_MODEL = 'gpt-5.1-chat';
export const EMBEDDINGS_MODEL = 'text-embedding-004';

export type AiMetadata = {
  modelGeneration: string;
  promptPackVersion: string;
  llmTextModel: string;
  llmChatModel: string;
  embeddingsModel: string;
};

export const AI_CONFIG: AiMetadata = {
  modelGeneration: AI_MODEL_GENERATION,
  promptPackVersion: PROMPT_PACK_VERSION,
  llmTextModel: LLM_TEXT_MODEL,
  llmChatModel: LLM_CHAT_MODEL,
  embeddingsModel: EMBEDDINGS_MODEL
};

export const AI_RESET_BANNER_MESSAGE = 'AI is regenerating. Please wait until green.';
export const AI_ACTIVE_BADGE = `AI ${AI_MODEL_GENERATION} active.`;

export type AiResetStatus = 'idle' | 'frozen' | 'regenerating' | 'ready';

export interface AiResetState {
  status: AiResetStatus;
  bannerMessage?: string;
  updatedAt: string;
  modelGeneration: string;
  promptPackVersion: string;
}

export function assertAiMetadata(): AiMetadata {
  if (!AI_CONFIG.modelGeneration || !AI_CONFIG.promptPackVersion) {
    throw new Error('AI metadata incomplete: generation and prompt pack must be set.');
  }
  return AI_CONFIG;
}

export function isAiActionBlocked(state: AiResetState | null | undefined): boolean {
  if (!state) {
    return false;
  }
  return state.status === 'frozen' || state.status === 'regenerating';
}

export function withAiTags<T extends Record<string, unknown>>(payload: T): T & {
  modelGeneration: string;
  promptPackVersion: string;
} {
  return {
    ...payload,
    modelGeneration: AI_MODEL_GENERATION,
    promptPackVersion: PROMPT_PACK_VERSION
  };
}
