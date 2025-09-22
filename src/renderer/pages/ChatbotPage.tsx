import React from 'react';
import AppShell from '../components/layout/AppShell';
import ChatbotInterface from '../components/chatbot/ChatbotInterface';

export default function ChatbotPage() {
  return (
    <AppShell pageTitle="AI Study Assistant">
      <ChatbotInterface />
    </AppShell>
  );
}
