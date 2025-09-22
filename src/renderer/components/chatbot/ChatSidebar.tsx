import React from 'react';
import { useChatbotStore, type ChatSession, type AIModel } from '../../state/chatbot';
import { PlusIcon, TrashIcon, EditIcon } from '../icons';
import { useCourses } from '../../state/dashboard';

type ChatSidebarProps = {
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  courses: any[];
};

export default function ChatSidebar({ 
  currentSessionId, 
  sessions, 
  selectedModel, 
  onModelChange,
  courses 
}: ChatSidebarProps) {
  const { createSession, deleteSession, selectSession, updateSessionTitle } = useChatbotStore();
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');

  const handleNewChat = () => {
    createSession();
  };

  const handleSessionSelect = (sessionId: string) => {
    selectSession(sessionId);
  };

  const handleSessionDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  const handleEditStart = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleEditSave = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSessionTitle(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleEditCancel = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const formatSessionTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getSessionTitle = (session: ChatSession) => {
    if (session.messages.length === 0) return 'New Chat';
    const firstMessage = session.messages.find(m => m.role === 'user');
    if (!firstMessage) return 'New Chat';
    return firstMessage.content.slice(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
  };

  return (
    <div 
      className="chat-sidebar"
      style={{
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div 
        className="chat-sidebar__header"
        style={{
          padding: '20px',
          borderBottom: '1px solid var(--surface-border)'
        }}
      >
        <h2 
          className="chat-sidebar__title"
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: '0 0 8px 0'
          }}
        >
          AI Study Assistant
        </h2>
        <p 
          className="chat-sidebar__subtitle"
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            margin: '0'
          }}
        >
          Your intelligent study companion
        </p>
      </div>

      <div 
        className="model-toggle"
        style={{ margin: '16px 20px' }}
      >
        <label 
          className="model-toggle__label"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          AI Model
        </label>
        <div 
          className="model-toggle__container"
          style={{
            display: 'flex',
            background: 'var(--surface-background)',
            border: '1px solid var(--surface-border)',
            borderRadius: '8px',
            padding: '2px'
          }}
        >
          <button
            className={`model-toggle__option ${selectedModel === 'basic' ? 'active' : ''}`}
            onClick={() => onModelChange('basic')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: selectedModel === 'basic' ? 'var(--button-primary-bg)' : 'transparent',
              color: selectedModel === 'basic' ? 'var(--button-primary-text)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Basic
          </button>
          <button
            className={`model-toggle__option ${selectedModel === 'advanced' ? 'active' : ''}`}
            onClick={() => onModelChange('advanced')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: selectedModel === 'advanced' ? 'var(--button-primary-bg)' : 'transparent',
              color: selectedModel === 'advanced' ? 'var(--button-primary-text)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Advanced
          </button>
        </div>
      </div>

      <div 
        className="sessions-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px'
        }}
      >
        <div 
          className="sessions-list__header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}
        >
          <h3 
            className="sessions-list__title"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: '0'
            }}
          >
            Recent Chats
          </h3>
          <button 
            className="new-chat-btn" 
            onClick={handleNewChat}
            style={{
              background: 'var(--button-primary-bg)',
              color: 'var(--button-primary-text)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <PlusIcon size={14} />
            New Chat
          </button>
        </div>

        <div className="sessions-list__content">
          {Object.values(sessions)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map((session) => (
              <div
                key={session.id}
                className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                onClick={() => handleSessionSelect(session.id)}
              >
                <div className="session-item__content">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={handleEditSave}
                      onKeyDown={handleKeyDown}
                      className="session-item__title"
                      autoFocus
                    />
                  ) : (
                    <h4 className="session-item__title">
                      {getSessionTitle(session)}
                    </h4>
                  )}
                  <p className="session-item__meta">
                    {formatSessionTime(session.updatedAt)}
                    {session.courseContext && ` • ${session.courseContext}`}
                  </p>
                </div>
                <div className="session-item__actions">
                  <button
                    className="session-item__action"
                    onClick={(e) => handleEditStart(e, session)}
                    title="Rename chat"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    className="session-item__action"
                    onClick={(e) => handleSessionDelete(e, session.id)}
                    title="Delete chat"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
