import type { LLMRequest } from "./types";

export type ProviderId = "openai" | "nemotron";

export function route(_req: LLMRequest): ProviderId {
  // Basic routing placeholder. Future logic can inspect request.
  return "openai";
}
