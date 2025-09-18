import React from 'react';
import type { ChatMessage } from '../state/store';

type ChatbotWidgetProps = {
  isOpen: boolean;
  messages: ChatMessage[];
  onMinimize: () => void;
  onSend: (text: string) => void;
};

export default function ChatbotWidget({ isOpen, messages, onMinimize, onSend }: ChatbotWidgetProps) {
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const active = document.activeElement;
    if (active && active instanceof HTMLElement) {
      previousFocusRef.current = active;
    }
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen || !previousFocusRef.current) return;
    const element = previousFocusRef.current;
    if (element && typeof element.focus === 'function') {
      if (typeof document === 'undefined' || document.contains(element)) {
        element.focus();
      }
    }
    previousFocusRef.current = null;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onSend(value);
    setDraft('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      id="dued8-chatbot-panel"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 380,
        maxHeight: '70vh',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 32px 60px rgba(15, 23, 42, 0.35)',
        overflow: 'hidden',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        zIndex: 1000
      }}
    >
      <header
        style={{
          padding: '16px 20px',
          background: '#1e293b',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>DueD8 Assistant</div>
          <div style={{ fontSize: 12, color: '#cbd5f5' }}>Ask questions about your coursework</div>
        </div>
        <button
          type="button"
          onClick={onMinimize}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f8fafc',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span aria-hidden="true">—</span>
          <span style={{ fontSize: 12 }}>Minimize</span>
        </button>
      </header>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          background: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.author === 'user' ? 'flex-end' : 'flex-start',
              background: message.author === 'user' ? '#2563eb' : '#e2e8f0',
              color: message.author === 'user' ? '#fff' : '#0f172a',
              padding: '10px 14px',
              borderRadius: 12,
              maxWidth: '80%',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)'
            }}
          >
            {message.text}
          </div>
        ))}
        {!messages.length && (
          <div style={{ color: '#64748b', fontSize: 14 }}>No messages yet. Say hi!</div>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          padding: 16,
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask DueD8 a question"
          style={{
            flex: 1,
            borderRadius: 999,
            border: '1px solid #cbd5f5',
            padding: '10px 16px',
            fontSize: 14,
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '10px 18px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
