import { getAiRuntimeConfig } from '../config/aiRuntime';
import type { PromptPack } from './types';
import { promptPackV2025 } from './v2025-10-04';

const promptPacks: Record<string, PromptPack> = {
  [promptPackV2025.version]: promptPackV2025
};

export function getPromptPack(version?: string): PromptPack {
  if (version && promptPacks[version]) {
    return promptPacks[version];
  }
  const runtime = getAiRuntimeConfig();
  return promptPacks[runtime.promptPackVersion] ?? promptPackV2025;
}

export type { PromptPack, PromptTemplate } from './types';
