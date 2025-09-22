import React from 'react';
import { type ChatMessage } from '../../state/chatbot';
import { FileIcon, YoutubeIcon } from '../icons';

type MessageListProps = {
  messages: ChatMessage[];
  isLoading: boolean;
};

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const renderAttachments = (attachments: ChatMessage['attachments']) => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="message__attachments">
        {attachments.map(attachment => (
          <div key={attachment.id} className="attachment">
            {attachment.type === 'file' ? (
              <FileIcon size={16} />
            ) : (
              <YoutubeIcon size={16} />
            )}
            <span>{attachment.name}</span>
            {attachment.url && (
              <a 
                href={attachment.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="attachment__link"
              >
                View
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {messages.map((message) => (
        <div key={message.id} className={`message message--${message.role}`}>
          <div className="message__avatar">
            {message.role === 'user' ? 'U' : 'AI'}
          </div>
          <div className="message__content">
            <div className="message__bubble">
              <p className="message__text">{message.content}</p>
              {renderAttachments(message.attachments)}
            </div>
            <div className="message__meta">
              <span>{formatTime(message.timestamp)}</span>
              <span className="message__model">{message.model}</span>
              {message.courseContext && (
                <span className="message__course">{message.courseContext}</span>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="message message--assistant">
          <div className="message__avatar">AI</div>
          <div className="message__content">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
