import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../state/chat';
import CitationList from './CitationList';
import '../../styles/chat.css';

export function MessageList(): JSX.Element {
  const messages = useChatStore((state) => state.messages);
  const retrievalHits = useChatStore((state) => state.retrievalHits);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chatbot-message-list" ref={containerRef}>
      {messages.map((message) => {
        const key = `${message.role}-${message.id}`;
        const hits = retrievalHits[message.id];
        return (
          <div
            key={key}
            className={`chatbot-message ${message.role}`}
            data-message-role={message.role}
          >
            <div>{message.content || (message.role === 'assistant' ? '…' : '')}</div>
            {message.role === 'assistant' && hits?.length ? (
              <div className="chatbot-citations" aria-label="Sources referenced">
                <strong>Sources</strong>
                <ul style={{ margin: 0, padding: 0 }}>
                  {hits.map((hit) => (
                    <li key={hit.id} style={{ listStyle: 'none' }}>
                      {hit.title} · {hit.source ?? 'local file'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {message.role === 'assistant' && message.citations?.length ? (
              <CitationList citations={message.citations} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
