import { describe, expect, it, vi } from 'vitest';
import { createChatTurn } from '../../electron/ai/orchestrator';
import * as retrieval from '../../electron/ai/retrieval';
import type { AIRetrievalHit } from '../../src/shared/types/ai';

const hits: AIRetrievalHit[] = [
  {
    id: 'doc-1',
    title: 'Algebra Notes',
    source: 'notes.pdf',
    snippet: 'The quadratic formula solves ax^2 + bx + c = 0.'
  }
];

describe('orchestrator retrieval integration', () => {
  it('emits retrieval hits and cites them in the final event', async () => {
    vi.spyOn(retrieval, 'search').mockResolvedValueOnce(hits);
    const turn = await createChatTurn({
      chatId: 'chat-1',
      messageId: 'msg-1',
      text: 'Explain the quadratic formula.',
      mode: 'basic'
    });
    const events: Array<Awaited<ReturnType<typeof createChatTurn>> extends { stream: AsyncGenerator<infer T> }
      ? T
      : never> = [];
    for await (const event of turn.stream) {
      events.push(event);
    }
    const retrievalEvent = events.find((event) => event.type === 'retrieval_hits');
    expect(retrievalEvent && retrievalEvent.type === 'retrieval_hits' ? retrievalEvent.items : []).toHaveLength(1);
    const finalEvent = events.find((event) => event.type === 'final');
    expect(finalEvent && finalEvent.type === 'final' ? finalEvent.citations : []).toEqual([
      { title: 'Algebra Notes', source: 'notes.pdf' }
    ]);
  });
});
