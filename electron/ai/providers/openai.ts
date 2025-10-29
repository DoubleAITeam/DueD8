import { setTimeout as delay } from 'node:timers/promises';
import type { AIProvider, ProviderStreamChunk, ProviderStreamOptions } from './base';

const DEFAULT_LATENCY_MS = 25;

export class OpenAIProvider implements AIProvider {
  async *completeStream(options: ProviderStreamOptions): AsyncIterable<ProviderStreamChunk> {
    const message = this.buildPlaceholderResponse(options);
    for (const token of message.split(/(\s+)/u)) {
      if (!token) {
        continue;
      }
      await delay(DEFAULT_LATENCY_MS);
      yield { type: 'token', text: token };
    }

    yield {
      type: 'final',
      usage: {
        prompt: options.messages.reduce((acc, item) => acc + item.content.length, 0),
        completion: message.length,
        total: options.messages.reduce((acc, item) => acc + item.content.length, 0) + message.length
      }
    } satisfies ProviderStreamChunk;
  }

  private buildPlaceholderResponse(options: ProviderStreamOptions): string {
    const lastUser = [...options.messages].reverse().find((msg) => msg.role === 'user');
    const intro = options.model.includes('advanced')
      ? 'Advanced insight:'
      : 'Quick take:';
    return `${intro} ${lastUser?.content ?? 'How can I assist you today?'}`.trim();
  }
}

export const openAIProvider = new OpenAIProvider();
