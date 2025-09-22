import React, { useState, useEffect } from 'react';
import { useChatbotStore } from '../../state/chatbot';
import { useDashboardStore, useDashboardData } from '../../state/dashboard';
import ChatSidebar from './ChatSidebar';
import ChatMain from './ChatMain';
import ChatRightPanel from './ChatRightPanel';
import './ChatbotInterface.css';

export default function ChatbotInterface() {
  try {
    const { currentSessionId, sessions, selectedModel, setSelectedModel } = useChatbotStore();
    const rawCourses = useDashboardStore((state) => state.rawCourses);
    const [showRightPanel, setShowRightPanel] = useState(true);

    const currentSession = currentSessionId ? sessions[currentSessionId] : null;

    // Load dashboard data to get courses
    useDashboardData();

    // Create initial session if none exists
    useEffect(() => {
      if (!currentSessionId && Object.keys(sessions).length === 0) {
        useChatbotStore.getState().createSession();
      }
    }, [currentSessionId, sessions]);

    return (
      <div 
        className="chatbot-interface"
        style={{
          height: 'calc(100vh - 120px)',
          background: 'var(--surface-background)',
          overflow: 'hidden'
        }}
      >
        <div 
          className="chatbot-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr 320px',
            height: '100%',
            gap: '1px',
            background: 'var(--surface-border)'
          }}
        >
          <ChatSidebar 
            currentSessionId={currentSessionId}
            sessions={sessions}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            courses={rawCourses || []}
          />
          
          <ChatMain 
            session={currentSession}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            courses={rawCourses || []}
          />
          
          {showRightPanel && (
            <ChatRightPanel 
              onClose={() => setShowRightPanel(false)}
              selectedModel={selectedModel}
              onPromptClick={(prompt) => {
                // This would be handled by the ChatMain component
                console.log('Prompt clicked:', prompt);
              }}
            />
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('ChatbotInterface error:', error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error loading chatbot</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}
