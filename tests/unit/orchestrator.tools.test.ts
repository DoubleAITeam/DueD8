import { describe, expect, it } from 'vitest';
import { deadlinesTool } from '../../electron/ai/tools/deadlines';
import { docSummarizeTool } from '../../electron/ai/tools/doc_summarize';
import { flashcardsTool } from '../../electron/ai/tools/flashcards';
import { youtubeTool } from '../../electron/ai/tools/youtube';

describe('tool definitions', () => {
  it('generates placeholder deadlines', async () => {
    const result = await deadlinesTool.execute({ limit: 2 });
    expect(result.data).toHaveLength(2);
  });

  it('summarises documents', async () => {
    const result = await docSummarizeTool.execute({ documentId: 'doc-1' });
    expect(result.summary).toContain('doc-1');
  });

  it('builds flashcards TSV', async () => {
    const result = await flashcardsTool.execute({ topic: 'Biology', count: 3 });
    expect(result.data).toMatchObject({ rows: expect.any(Array), tsv: expect.stringContaining('\t') });
  });

  it('describes youtube videos', async () => {
    const result = await youtubeTool.execute({ url: 'https://youtu.be/demo' });
    expect(result.data).toMatchObject({ url: 'https://youtu.be/demo' });
  });
});
