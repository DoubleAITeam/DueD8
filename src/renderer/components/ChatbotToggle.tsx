import React from 'react';

type ChatbotToggleProps = {
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
};

function ensurePulseStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dued8-chatbot-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'dued8-chatbot-pulse-style';
  style.textContent = `
    @keyframes dued8-chatbot-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
      }
    }
  `;
  document.head.appendChild(style);
}

export default function ChatbotToggle({ isOpen, unreadCount, onToggle }: ChatbotToggleProps) {
  React.useEffect(() => {
    ensurePulseStyle();
  }, []);

  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls="dued8-chatbot-panel"
      onClick={onToggle}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        background: '#1e293b',
        color: '#f8fafc',
        border: 'none',
        borderRadius: 999,
        padding: '12px 18px',
        cursor: 'pointer',
        alignItems: 'center',
        gap: 8,
        fontWeight: 600,
        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.35)',
        animation: hasUnread ? 'dued8-chatbot-pulse 2s infinite' : undefined,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        display: isOpen ? 'none' : 'flex'
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.boxShadow = '0 20px 40px rgba(15, 23, 42, 0.4)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.boxShadow = '0 16px 32px rgba(15, 23, 42, 0.35)';
      }}
    >
      <span role="img" aria-hidden="true">
        💬
      </span>
      Chat with DueD8
      {hasUnread && (
        <span
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: '#f97316',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            padding: '0 6px'
          }}
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
