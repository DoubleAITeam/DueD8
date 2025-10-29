import type { LLMRequest, LLMResponse } from "../types";

export async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  const lastUser = [...req.messages].reverse().find((msg) => msg.role === "user");
  const content = `Quick take: ${lastUser?.content ?? "How can I assist you today?"}`.trim();

  return {
    id: `openai-${Date.now()}`,
    model: req.model,
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        message: { role: "assistant", content }
      }
    ],
    usage: {
      prompt: req.messages.reduce((acc, item) => acc + item.content.length, 0),
      completion: content.length,
      total: req.messages.reduce((acc, item) => acc + item.content.length, 0) + content.length
    }
  };
}
