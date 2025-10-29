import type { AiToolDefinition } from './types';

export const flashcardsTool: AiToolDefinition = {
  name: 'flashcards',
  description: 'Create TSV-formatted flashcards with optional cloze deletions.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Topic to generate flashcards for.' },
      count: { type: 'number', description: 'Number of flashcards requested.', minimum: 1, maximum: 20, default: 5 }
    },
    required: ['topic']
  },
  async execute(args) {
    const count = Math.max(1, Math.min(Number(args.count ?? 5), 20));
    const topic = String(args.topic ?? 'general study skills');
    const rows: Array<{ question: string; answer: string }> = [];
    for (let index = 0; index < count; index += 1) {
      rows.push({
        question: `${topic} concept ${index + 1}?`,
        answer: `${topic} explanation ${index + 1}.`
      });
    }
    const tsv = rows.map((row) => `${row.question}\t${row.answer}`).join('\n');
    return { summary: `Generated ${rows.length} placeholder flashcards.`, data: { rows, tsv } };
  }
};
