import type { LLMRequest, LLMResponse } from "./types";
import { buildContextPack } from "../context/orchestrator";
import { composeChatRequest } from "./prompt/compose";
import { getActiveCourse } from "../appsBridge/threadMeta";
import { route } from "./router";
import { meter } from "./meter";
import { callOpenAI } from "./providers/openai";
import { callNemotron } from "./providers/nemotron";

export async function callModelWithContext(
  req: LLMRequest,
  threadId: string,
  userQueryText: string
): Promise<LLMResponse> {
  const courseId = getActiveCourse(threadId);
  const ctx = await buildContextPack({ courseId, query: userQueryText, k: 6, tokenBudget: 1200 });
  const finalReq = composeChatRequest(req, ctx);

  const provider = route(finalReq);
  const res = provider === "nemotron" ? await callNemotron(finalReq) : await callOpenAI(finalReq);
  meter.commit(res.usage, provider);
  return res;
}
