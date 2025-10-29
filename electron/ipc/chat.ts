import { ipcMain, BrowserWindow } from 'electron';
import { createChatTurn } from '../ai/orchestrator';
import type { AIStartRequest, AIStreamEvent } from '../../src/shared/types/ai';
import { enforceHardStop } from '../guards/budgetGate';
import { trackAiToolCall, trackAiTurnFinal, trackAiTurnStart } from '../analytics';

const STREAM_CHANNEL = 'ai.chat.stream';
const PAYWALL_CHANNEL = 'ui/paywall:open';

ipcMain.on('ai.chat.start', (event, payload: AIStartRequest) => {
  void handleChatStart(event.sender, payload);
});

async function handleChatStart(
  sender: Electron.WebContents,
  payload: AIStartRequest
): Promise<void> {
  if (!enforceHardStop('ai.chat.start')) {
    sender.send(STREAM_CHANNEL, envelope(payload.messageId, {
      type: 'error',
      code: 'OVER_CAP',
      message: 'You have reached today\'s AI token limit.'
    }));
    sender.send(PAYWALL_CHANNEL, {});
    return;
  }

  const startedAt = Date.now();
  try {
    const turn = await createChatTurn(payload);
    trackAiTurnStart({
      chatId: payload.chatId,
      messageId: payload.messageId,
      model: turn.model,
      mode: payload.mode
    });

    for await (const event of turn.stream) {
      if (event.type === 'tool_call') {
        trackAiToolCall({
          chatId: payload.chatId,
          messageId: payload.messageId,
          tool: event.name
        });
      }
      sender.send(STREAM_CHANNEL, envelope(payload.messageId, event));
      if (event.type === 'final') {
        const latency = Date.now() - startedAt;
        trackAiTurnFinal({
          chatId: payload.chatId,
          messageId: payload.messageId,
          model: turn.model,
          mode: payload.mode,
          latencyMs: latency,
          usage: event.usage
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sender.send(STREAM_CHANNEL, envelope(payload.messageId, {
      type: 'error',
      code: 'TURN_FAILED',
      message
    } satisfies AIStreamEvent));
  }
}

function envelope(messageId: string, event: AIStreamEvent) {
  return { messageId, event };
}

export function broadcastPaywall(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(PAYWALL_CHANNEL, {});
  }
}
