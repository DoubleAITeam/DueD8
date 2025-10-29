export type AIChatMode = 'basic' | 'advanced';

export type AIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type AIMessage = {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: number;
  model?: string;
  citations?: AICitation[];
};

export type AIRetrievalHit = {
  id: string;
  title: string;
  source?: string;
  snippet: string;
  score?: number;
};

export type AICitation = {
  title: string;
  source: string;
};

export type AIToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type AIStreamUsage = {
  prompt: number;
  completion: number;
  total: number;
};

export type AIStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'retrieval_hits'; items: AIRetrievalHit[] }
  | { type: 'final'; usage: AIStreamUsage; citations: AICitation[] }
  | { type: 'error'; code: string; message: string };

export type AIUpload = {
  id: string;
  name: string;
  mime?: string;
  path: string;
};

export type AIStartRequest = {
  chatId: string;
  messageId: string;
  text: string;
  mode: AIChatMode;
  courseId?: string;
  uploads?: AIUpload[];
  youtubeUrl?: string;
  preferences?: string;
  recent?: string[];
};

export type AIStreamEnvelope = {
  messageId: string;
  event: AIStreamEvent;
};
