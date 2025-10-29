import React, { useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import MessageList from '../components/chat/MessageList';
import Composer from '../components/chat/Composer';
import { useChatStore } from '../state/chat';
import { bootstrapBudgetState, useBudgetStore } from '../state/budget';
import { useDashboardData, useDashboardStore } from '../state/dashboard';
import '../styles/chat.css';

export default function Chatbot(): JSX.Element {
  const messages = useChatStore((state) => state.messages);
  const mode = useChatStore((state) => state.mode);
  const selectedCourseId = useChatStore((state) => state.selectedCourseId);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const budget = useBudgetStore();
  const courses = useDashboardStore((state) => state.rawCourses ?? []);

  useDashboardData();

  useEffect(() => {
    void bootstrapBudgetState();
    const off = window.dued8.ai.paywall.onOpen(() => {
      useBudgetStore.getState().openUpgradeModal();
    });
    return () => {
      off();
    };
  }, []);

  return (
    <AppShell pageTitle="AI Study Assistant">
      <div className="chatbot-root">
        <header className="chatbot-header">
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>Chatbot Pro</h1>
            <div className="chatbot-metadata">
              <span>Mode: {mode === 'advanced' ? 'Advanced (GPT-5)' : 'Basic (GPT-4o mini)'}</span>
              {selectedCourseId ? <span>Course: {selectedCourseId}</span> : <span>No course selected</span>}
              <span>{messages.length} messages</span>
            </div>
          </div>
          <div className="chatbot-metadata" role="status">
            <span>{isStreaming ? 'Streaming…' : 'Idle'}</span>
            <span>
              {Math.max(0, Math.round(budget.cap - budget.used)).toLocaleString()} tokens remaining
            </span>
          </div>
        </header>
        <div className="chatbot-body">
          <MessageList />
          <Composer
            courses={courses.map((course) => ({
              id: String(course.id ?? course.sis_course_id ?? course.name ?? ''),
              name: course.name ?? course.courseCode ?? 'Course'
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}
