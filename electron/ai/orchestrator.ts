import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderMessage } from './providers/base';
import { openAIProvider } from './providers/openai';
import type { AiToolDefinition } from './tools/types';
import { deadlinesTool } from './tools/deadlines';
import { docSummarizeTool } from './tools/doc_summarize';
import { flashcardsTool } from './tools/flashcards';
import { youtubeTool } from './tools/youtube';
import type {
  AIStreamEvent,
  AIStartRequest,
  AIStreamUsage,
  AIRetrievalHit
} from '../../src/shared/types/ai';
import { search as searchRetrieval } from './retrieval';

const SYSTEM_PROMPT_PATH = path.join(__dirname, 'prompts', 'baseSystemPrompt.txt');
let cachedSystemPrompt: string | null = null;

export type ChatTurn = {
  model: string;
  stream: AsyncGenerator<AIStreamEvent, void, unknown>;
};

export async function createChatTurn(payload: AIStartRequest): Promise<ChatTurn> {
  const model = resolveModel(payload.mode);
  const systemPrompt = await loadSystemPrompt();
  const retrievalHits = await searchRetrieval(payload);
  const providerMessages: ProviderMessage[] = buildMessages(systemPrompt, payload, retrievalHits);

  async function* generator(): AsyncGenerator<AIStreamEvent> {
    if (retrievalHits.length > 0) {
      yield { type: 'retrieval_hits', items: retrievalHits } satisfies AIStreamEvent;
    }

    let finalUsage: AIStreamUsage | null = null;
    for await (const chunk of openAIProvider.completeStream({
      model,
      systemPrompt,
      messages: providerMessages,
      tools: getTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })),
      maxTokens: Number.parseInt(process.env.CHAT_MAX_TOKENS ?? '2200', 10)
    })) {
      if (chunk.type === 'token') {
        yield { type: 'token', text: chunk.text } satisfies AIStreamEvent;
      } else if (chunk.type === 'tool_call') {
        yield { type: 'tool_call', name: chunk.name, args: chunk.args } satisfies AIStreamEvent;
        const tool = getTools().find((entry) => entry.name === chunk.name);
        if (tool) {
          const result = await tool.execute(chunk.args);
          yield { type: 'tool_result', name: chunk.name, result } satisfies AIStreamEvent;
        }
      } else if (chunk.type === 'tool_result') {
        yield { type: 'tool_result', name: chunk.name, result: chunk.result } satisfies AIStreamEvent;
      } else if (chunk.type === 'error') {
        yield { type: 'error', code: chunk.code, message: chunk.message } satisfies AIStreamEvent;
      } else if (chunk.type === 'final') {
        finalUsage = chunk.usage ?? null;
      }
    }

    yield {
      type: 'final',
      usage: finalUsage ?? { prompt: 0, completion: 0, total: 0 },
      citations: buildCitations(retrievalHits)
    } satisfies AIStreamEvent;
  }

  return { model, stream: generator() };
}

function buildMessages(
  systemPrompt: string,
  payload: AIStartRequest,
  retrievalHits: AIRetrievalHit[]
): ProviderMessage[] {
  const messages: ProviderMessage[] = [
    { role: 'system', content: injectMemorySlots(systemPrompt, payload) }
  ];

  if (retrievalHits.length > 0) {
    const formatted = retrievalHits
      .map((hit, index) => `<doc id="${hit.id}" title="${hit.title}">\n${hit.snippet}\n</doc>`)
      .join('\n\n');
    messages.push({ role: 'system', content: `Retrieved context:\n${formatted}` });
  }

  messages.push({ role: 'user', content: payload.text });
  return messages;
}

function injectMemorySlots(prompt: string, payload: AIStartRequest): string {
  const courseContext = payload.courseId ? `Course: ${payload.courseId}` : 'Course: none';
  const uploads = payload.uploads?.map((file) => file.name).join(', ') ?? 'None';
  const youtube = payload.youtubeUrl ?? 'None';
  return prompt
    .replace('{user_prefs}', payload.preferences ?? 'No stored preferences.')
    .replace('{course_context}', courseContext)
    .replace('{recent_turns}', payload.recent?.join('\n') ?? 'No prior turns.')
    .replace('{retrieval_snippets}', 'See attached retrieval context if present.')
    .replace('{tools_schema}', describeTools())
    .concat(`\nUploads: ${uploads}\nYouTube: ${youtube}`);
}

function describeTools(): string {
  return getTools()
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join('\n');
}

function getTools(): AiToolDefinition[] {
  return [deadlinesTool, docSummarizeTool, flashcardsTool, youtubeTool];
}

function buildCitations(hits: AIRetrievalHit[]) {
  return hits.map((hit) => ({ title: hit.title, source: hit.source ?? hit.id }));
}

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }
  try {
    cachedSystemPrompt = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf-8');
    return cachedSystemPrompt;
  } catch (error) {
    cachedSystemPrompt =
      'DueD8 AI Study Assistant. Memory slots unavailable. Proceed with concise helpful replies.';
    return cachedSystemPrompt;
  }
}

function resolveModel(mode: AIStartRequest['mode']): string {
  if (mode === 'advanced') {
    return process.env.AI_MODEL_ADVANCED ?? 'gpt-5';
  }
  return process.env.AI_MODEL_BASIC ?? 'gpt-4o-mini';
}
