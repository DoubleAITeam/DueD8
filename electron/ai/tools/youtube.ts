import type { AiToolDefinition } from './types';

export const youtubeTool: AiToolDefinition = {
  name: 'youtube',
  description: 'Explain a YouTube link, summarising chapters and key timestamps.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', description: 'The YouTube video URL.' },
      question: { type: 'string', description: 'Specific question to answer about the video.' }
    },
    required: ['url']
  },
  async execute(args) {
    const url = String(args.url ?? 'https://youtube.com');
    return {
      summary: `Placeholder YouTube explanation for ${url}.`,
      data: {
        url,
        question: args.question ?? null,
        chapters: [
          { label: 'Introduction', timestamp: '00:00', note: 'Replace with transcript-derived summary.' },
          { label: 'Key Idea', timestamp: '02:30', note: 'Explain important concept once transcript ingestion is implemented.' }
        ]
      }
    };
  }
};
