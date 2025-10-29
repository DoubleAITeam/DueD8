export type ToolExecution = (
  args: Record<string, unknown>
) => Promise<{ summary: string; data?: unknown }>;

export type AiToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: ToolExecution;
};
