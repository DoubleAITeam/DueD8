export type ProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ProviderMessage = {
  role: ProviderMessageRole;
  content: string;
  name?: string;
};

export type ProviderToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ProviderToolResult = {
  name: string;
  result: unknown;
};

export type ProviderStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'error'; code: string; message: string }
  | { type: 'final'; usage?: { prompt: number; completion: number; total: number } };

export type ProviderStreamOptions = {
  model: string;
  systemPrompt: string;
  messages: ProviderMessage[];
  tools?: ProviderToolSchema[];
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

export interface AIProvider {
  completeStream(options: ProviderStreamOptions): AsyncIterable<ProviderStreamChunk>;
}
