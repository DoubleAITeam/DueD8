import { format } from 'node:util';
import type { AiToolDefinition } from './types';

export const deadlinesTool: AiToolDefinition = {
  name: 'deadlines',
  description: 'List upcoming assignment deadlines from the student planner.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of assignments to include.',
        minimum: 1,
        maximum: 20,
        default: 5
      }
    }
  },
  async execute(args) {
    const limit = Math.max(1, Math.min(Number(args.limit ?? 5), 20));
    const rows = Array.from({ length: limit }, (_value, index) => ({
      title: `Assignment ${index + 1}`,
      dueAt: new Date(Date.now() + index * 86_400_000).toISOString(),
      course: 'Course TBD'
    }));
    return {
      summary: format('Returning %d placeholder deadlines.', rows.length),
      data: rows
    };
  }
};
