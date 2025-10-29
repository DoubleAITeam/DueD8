export type AppMessageRole = "system" | "user" | "assistant";

export type AppMessage = {
  role: AppMessageRole;
  content: string;
};

export type LLMRequest = {
  model: string;
  messages: AppMessage[];
  stream?: boolean;
};

export type Usage = { prompt: number; completion: number; total: number };

export type LLMResponse = {
  id: string;
  model: string;
  created: number;
  choices: Array<{ index: number; message: AppMessage }>;
  usage: Usage;
};
