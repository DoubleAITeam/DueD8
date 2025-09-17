import React from 'react';
import { createPortal } from 'react-dom';
import ChatbotToggle from './ChatbotToggle';
import ChatbotWidget from './ChatbotWidget';
import { useStore } from '../state/store';

export default function ChatbotHost() {
  const chatOpen = useStore((state) => state.chatOpen);
  const chatUnread = useStore((state) => state.chatUnread);
  const messages = useStore((state) => state.chatMessages);
  const toggleChat = useStore((state) => state.toggleChat);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const sendMessage = useStore((state) => state.sendChatMessage);

  const hostRef = React.useRef<HTMLElement | null>(null);

  if (typeof document !== 'undefined' && !hostRef.current) {
    hostRef.current = document.createElement('div');
    hostRef.current.setAttribute('id', 'dued8-chatbot-container');
    hostRef.current.setAttribute('aria-live', 'polite');
    hostRef.current.style.position = 'relative';
  }

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof document === 'undefined') return undefined;
    document.body.appendChild(el);
    return () => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'j') {
        event.preventDefault();
        toggleChat();
      } else if (event.key === 'Escape' && chatOpen) {
        event.preventDefault();
        setChatOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleChat, chatOpen, setChatOpen]);

  if (!hostRef.current) return null;

  return createPortal(
    <>
      <ChatbotToggle isOpen={chatOpen} unreadCount={chatUnread} onToggle={toggleChat} />
      <ChatbotWidget isOpen={chatOpen} messages={messages} onMinimize={() => setChatOpen(false)} onSend={sendMessage} />
    </>,
    hostRef.current
  );
}
