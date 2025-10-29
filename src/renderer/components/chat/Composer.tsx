import React, { useCallback, useState } from 'react';
import { useChatStore } from '../../state/chat';
import { useBudgetStore } from '../../state/budget';
import type { AIStreamEvent } from '../../../shared/types/ai';
import '../../styles/chat.css';

type ComposerProps = {
  courses?: Array<{ id: string; name: string }>;
};

export function Composer({ courses }: ComposerProps): JSX.Element {
  const [value, setValue] = useState('');
  const mode = useChatStore((state) => state.mode);
  const setMode = useChatStore((state) => state.setMode);
  const chatId = useChatStore((state) => state.chatId);
  const memory = useChatStore((state) => state.memory);
  const beginUserTurn = useChatStore((state) => state.beginUserTurn);
  const appendAssistant = useChatStore((state) => state.appendAssistant);
  const completeAssistant = useChatStore((state) => state.completeAssistant);
  const setStreaming = useChatStore((state) => state.setStreaming);
  const recordHits = useChatStore((state) => state.recordRetrievalHits);
  const setError = useChatStore((state) => state.setError);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const selectedCourseId = useChatStore((state) => state.selectedCourseId);
  const setCourseId = useChatStore((state) => state.setCourseId);
  const budget = useBudgetStore();
  const remaining = Math.max(0, Math.round(budget.cap - budget.used));
  const error = useChatStore((state) => state.error);

  const sendMessage = useCallback(() => {
    if (!value.trim()) {
      return;
    }
    setError(null);
    const { assistantId } = beginUserTurn(value.trim());
    setValue('');
    setStreaming(true, assistantId);
    let cleanup: (() => void) | null = null;
    const handler = (event: AIStreamEvent) => {
      if (event.type === 'token') {
        appendAssistant(assistantId, event.text);
      } else if (event.type === 'retrieval_hits') {
        recordHits(assistantId, event.items);
      } else if (event.type === 'final') {
        completeAssistant(assistantId, event.citations);
        setStreaming(false, null);
        cleanup?.();
      } else if (event.type === 'error') {
        setError(event.message);
        setStreaming(false, null);
        cleanup?.();
      }
    };
    cleanup = window.dued8.ai.chat.onEvent(assistantId, handler);
    window.dued8.ai.chat.start({
      chatId,
      messageId: assistantId,
      text: value.trim(),
      mode,
      courseId: selectedCourseId,
      preferences: memory.userPreferences,
      recent: memory.recentTurns
    });
    // Provide manual fallback cleanup for edge cases.
    setTimeout(() => {
      if (!useChatStore.getState().isStreaming) {
        cleanup?.();
      }
    }, 60_000);
  }, [appendAssistant, beginUserTurn, chatId, completeAssistant, memory, mode, recordHits, selectedCourseId, setError, setStreaming, value]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (budget.isOverCap) {
      useBudgetStore.getState().openUpgradeModal();
      return;
    }
    sendMessage();
  };

  return (
    <form className="chatbot-composer" onSubmit={onSubmit}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask DueD8 anything about your courses…"
        disabled={isStreaming || budget.isOverCap}
        aria-label="Chat message"
      />
      {error ? (
        <div role="alert" style={{ color: 'var(--text-danger)', fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      ) : null}
      <div className="chatbot-composer-actions">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            <input
              type="radio"
              name="chat-mode"
              value="basic"
              checked={mode === 'basic'}
              onChange={() => setMode('basic')}
            />{' '}
            Basic
          </label>
          <label>
            <input
              type="radio"
              name="chat-mode"
              value="advanced"
              checked={mode === 'advanced'}
              onChange={() => setMode('advanced')}
            />{' '}
            Advanced
          </label>
          <select
            value={selectedCourseId ?? ''}
            onChange={(event) => setCourseId(event.target.value || undefined)}
            aria-label="Course context"
          >
            <option value="">No course</option>
            {courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {remaining.toLocaleString()} tokens left today
          </span>
          <button type="submit" disabled={isStreaming || budget.isOverCap}>
            {isStreaming ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default Composer;
