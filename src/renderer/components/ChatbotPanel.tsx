import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment, Course } from '../../lib/canvasClient';
import type { AssignmentContextEntry, ViewState } from '../state/store';
import { useStore } from '../state/store';

const MODEL_NAME = 'gpt-4o-mini';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Props = {
  view: ViewState;
  profileName?: string;
  selectedCourse: Course | null;
  selectedAssignment: Assignment | null;
  courseAssignments: Assignment[];
  upcomingAssignments: Assignment[];
  assignmentCourseName?: string;
  courseLookup: Record<number, string>;
};

function formatAssignmentsSummary(assignments: Assignment[], courseLookup: Record<number, string>) {
  if (!assignments.length) {
    return 'No upcoming deadlines recorded in the current window.';
  }
  return assignments.slice(0, 3).map((assignment) => {
    const due = assignment.due_at ? new Date(assignment.due_at).toLocaleString() : 'No due date provided';
    const courseName = courseLookup[assignment.course_id] ?? 'Unknown course';
    return `• ${assignment.name} (${courseName}) — due ${due}`;
  }).join('\n');
}

function summarizeContexts(contexts: AssignmentContextEntry[]) {
  if (!contexts.length) {
    return 'No supporting documents uploaded yet.';
  }
  return contexts.slice(-3).map((entry) => {
    const snippet = entry.content.length > 160 ? `${entry.content.slice(0, 160)}…` : entry.content;
    return `• ${entry.fileName}: ${snippet}`;
  }).join('\n');
}

// PHASE 3: Compose a lightweight stand-in response that references GPT-4o-mini for transparency.
function composeAssistantResponse(options: {
  view: ViewState;
  message: string;
  profileName?: string;
  selectedCourse: Course | null;
  selectedAssignment: Assignment | null;
  assignmentCourseName?: string;
  courseAssignments: Assignment[];
  upcomingAssignments: Assignment[];
  assignmentContexts: AssignmentContextEntry[];
  courseLookup: Record<number, string>;
}) {
  const {
    view,
    message,
    profileName,
    selectedCourse,
    selectedAssignment,
    assignmentCourseName,
    courseAssignments,
    upcomingAssignments,
    assignmentContexts,
    courseLookup
  } = options;

  const lines: string[] = [];
  lines.push(`Simulated ${MODEL_NAME} reply for ${profileName ? `${profileName}'s` : 'your'} workspace.`);
  lines.push(`You asked: "${message}"`);

  if (view.screen === 'assignment' && selectedAssignment) {
    lines.push(
      `Focus assignment: ${selectedAssignment.name}${assignmentCourseName ? ` (${assignmentCourseName})` : ''}.`
    );
    lines.push(`Due: ${selectedAssignment.due_at ? new Date(selectedAssignment.due_at).toLocaleString() : 'No due date recorded.'}`);
    lines.push('Latest uploaded context:');
    lines.push(summarizeContexts(assignmentContexts));
  } else if (view.screen === 'course' && selectedCourse) {
    lines.push(`Course spotlight: ${selectedCourse.name}.`);
    lines.push('Upcoming work for this course:');
    lines.push(formatAssignmentsSummary(courseAssignments, courseLookup));
  } else {
    lines.push('Here is a snapshot of upcoming responsibilities:');
    lines.push(formatAssignmentsSummary(upcomingAssignments, courseLookup));
  }

  lines.push('Let me know if you want timelines, study plans, or a deeper breakdown!');
  return lines.join('\n\n');
}

export default function ChatbotPanel({
  view,
  profileName,
  selectedCourse,
  selectedAssignment,
  courseAssignments,
  upcomingAssignments,
  assignmentCourseName,
  courseLookup
}: Props) {
  const assignmentContextsMap = useStore((s) => s.assignmentContexts);
  const activeAssignmentContexts = selectedAssignment
    ? assignmentContextsMap[selectedAssignment.id] ?? []
    : [];
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi${profileName ? ` ${profileName}` : ''}! I'm your DueD8 study coach.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0].role !== 'assistant') return prev;
      const next = [...prev];
      next[0] = {
        role: 'assistant',
        content: `Hi${profileName ? ` ${profileName}` : ''}! I'm your DueD8 study coach.`
      };
      return next;
    });
  }, [profileName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  const suggestions = useMemo(() => {
    if (view.screen === 'assignment' && selectedAssignment) {
      const latestDoc = activeAssignmentContexts.at(-1);
      return [
        latestDoc
          ? `Summarise ${latestDoc.fileName} for ${selectedAssignment.name}.`
          : `Summarise the uploaded notes for ${selectedAssignment.name}.`,
        `Help me finish ${selectedAssignment.name} on time.`,
        `What should I review before submitting ${selectedAssignment.name}?`
      ];
    }
    if (view.screen === 'course' && selectedCourse) {
      return [
        `Map out this week for ${selectedCourse.name}.`,
        `List upcoming deadlines in ${selectedCourse.name}.`,
        `Suggest revision topics for ${selectedCourse.name}.`
      ];
    }
    const topAssignment = upcomingAssignments[0]?.name;
    return [
      'What deadlines should I prepare for this week?',
      topAssignment ? `How should I start ${topAssignment}?` : 'Help me prioritise my workload.',
      'Suggest a balanced study plan for the next few days.'
    ];
  }, [view, selectedAssignment, selectedCourse, activeAssignmentContexts, upcomingAssignments]);

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const reply = composeAssistantResponse({
      view,
      message: trimmed,
      profileName,
      selectedCourse,
      selectedAssignment,
      assignmentCourseName,
      courseAssignments,
      upcomingAssignments,
      assignmentContexts: activeAssignmentContexts,
      courseLookup
    });

    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setLoading(false);
    }, 200);
  }

  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 'min(360px, calc(100% - 32px))',
        maxHeight: '70vh',
        background: 'var(--surface-card)',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
        border: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
        <strong>Study Coach</strong>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Model: {MODEL_NAME}</div>
      </header>
      <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => sendMessage(suggestion)}
            disabled={loading}
            style={{
              border: '1px solid var(--surface-border)',
              borderRadius: 999,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.85)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              background: message.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.9)',
              color: message.role === 'user' ? '#fff' : 'var(--text-secondary)',
              borderRadius: 16,
              padding: '10px 14px',
              maxWidth: '90%',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4
            }}
          >
            {message.content}
          </div>
        ))}
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Thinking…</div>
        ) : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 20px',
          borderTop: '1px solid var(--surface-border)',
          background: 'rgba(255,255,255,0.9)'
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything about your Canvas work"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid var(--surface-border)',
            borderRadius: 12,
            padding: '8px 10px',
            fontFamily: 'inherit'
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: loading ? 'rgba(10, 132, 255, 0.4)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '8px 16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
