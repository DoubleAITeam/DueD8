import type { AppMessage, LLMRequest } from "../types";
import type { ContextPack } from "../../context/orchestrator";

export function composeChatRequest(
  base: Omit<LLMRequest, "messages"> & { messages: AppMessage[] },
  ctx: ContextPack
): LLMRequest {
  const ctxBlock = [
    ctx.studentSummary ? `\n[Student]\n${ctx.studentSummary}` : "",
    ctx.syllabusSnippets.length
      ? `\n[Syllabus]\n${ctx.syllabusSnippets
          .map((s, i) => `(${i + 1}) ${s.heading ?? "Untitled"}${s.dateISO ? ` [${s.dateISO}]` : ""}\n${s.text}`)
          .join("\n\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const system: AppMessage = { role: "system", content: `${ctx.systemDirectives}\n${ctxBlock}`.trim() };
  return { ...base, messages: [system, ...base.messages] };
}
