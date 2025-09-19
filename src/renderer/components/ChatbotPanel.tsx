import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment, Course } from '../../lib/canvasClient';
import type { AssignmentContextEntry, ViewState } from '../state/store';
import { useStore } from '../state/store';
import { featureFlags } from '../../shared/featureFlags';

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

const GREETING_KEYWORDS = new Set([
  'hi',
  'hello',
  'hey',
  'hiya',
  'good morning',
  'good afternoon',
  'good evening'
]);

function tokeniseForSimilarity(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function computeSimilarityScore(a: string, b: string) {
  const tokensA = new Set(tokeniseForSimilarity(a));
  const tokensB = new Set(tokeniseForSimilarity(b));
  if (!tokensA.size || !tokensB.size) {
    return 0;
  }
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  });
  return overlap / Math.min(tokensA.size, tokensB.size);
}

function compressResponseSegments(response: string) {
  const segments = response.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];
  segments.forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed.length) {
      if (result.length && result[result.length - 1] !== '') {
        result.push('');
      }
      return;
    }
    const normalised = trimmed
      .replace(/^[•*\-]\s*/, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!seen.has(normalised)) {
      seen.add(normalised);
      result.push(trimmed);
    }
  });
  while (result.length && result[result.length - 1] === '') {
    result.pop();
  }
  return result.join('\n');
}

function postProcessAssistantResponse(pending: string, previous?: string) {
  if (!previous?.trim()) {
    return pending;
  }
  const similarity = computeSimilarityScore(pending, previous);
  if (similarity <= 0.6) {
    return pending;
  }
  const compressed = compressResponseSegments(pending);
  const closing = 'Let me know if you want a different angle next time.';
  if (compressed.includes(closing)) {
    return compressed;
  }
  return `${compressed}\n\n${closing}`;
}

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
  friendly: boolean;
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
    courseLookup,
    friendly
  } = options;

  const trimmedMessage = message.trim();
  const lowered = trimmedMessage.toLowerCase();
  const firstName = profileName?.split(' ')[0];

  if (friendly && GREETING_KEYWORDS.has(lowered)) {
    const targetName = firstName ? (firstName.toLowerCase() === 'ahmed' ? 'Ahmed' : firstName) : 'there';
    return `Hi ${targetName}! I'm DueD8 Study Coach—ready whenever you want to plan, prioritise, or ask a question.`;
  }

  const sections: string[] = [];
  if (friendly) {
    sections.push(`Hey${firstName ? ` ${firstName}` : ''}, let's tackle “${trimmedMessage}.”`);
  } else {
    sections.push(`You asked: "${trimmedMessage}"`);
  }

  if (view.screen === 'assignment' && selectedAssignment) {
    const due = selectedAssignment.due_at
      ? new Date(selectedAssignment.due_at).toLocaleString()
      : 'No due date recorded';
    sections.push(
      `Focus: ${selectedAssignment.name}${assignmentCourseName ? ` (${assignmentCourseName})` : ''}. Due ${due}.`
    );
    const contextSummary = summarizeContexts(assignmentContexts);
    if (contextSummary.trim().length) {
      sections.push(`Recent context:\n${contextSummary}`);
    }
    const actionItems = [
      'Outline the key deliverables before you start drafting.',
      'Block time for a rough pass and a final review.',
      'Note any unclear expectations so we can clarify them early.'
    ];
    sections.push(`Next steps to keep momentum:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  } else if (view.screen === 'course' && selectedCourse) {
    sections.push(`Course spotlight: ${selectedCourse.name}.`);
    sections.push('Upcoming work:');
    sections.push(formatAssignmentsSummary(courseAssignments, courseLookup));
    const actionItems = [
      'Skim the syllabus or notes for this week.',
      'Plan study blocks around the nearest deadline.',
      'Flag topics that still feel shaky so we can review them.'
    ];
    sections.push(`Quick wins:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  } else {
    sections.push('Here is what’s on your radar next:');
    sections.push(formatAssignmentsSummary(upcomingAssignments, courseLookup));
    const actionItems = [
      'Choose the most urgent task and start there.',
      'Balance high-effort and quick wins through the week.',
      'Set checkpoints so nothing sneaks up on you.'
    ];
    sections.push(`Game plan ideas:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  }

  sections.push('Ask me for a timeline, resource suggestions, or a deeper breakdown anytime.');
  return sections.join('\n\n');
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
  const chatbotMinimized = useStore((s) => s.chatbotMinimized);
  const setChatbotMinimized = useStore((s) => s.setChatbotMinimized);
  const chatFriendly = featureFlags.chatFriendliness;
  const baseGreeting = chatFriendly
    ? `Hi${profileName ? ` ${profileName}` : ''}! I'm DueD8 Study Coach—here whenever you need a study boost.`
    : `Hi${profileName ? ` ${profileName}` : ''}! I'm your DueD8 study coach.`;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: baseGreeting
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
        content: baseGreeting
      };
      return next;
    });
  }, [profileName, baseGreeting]);

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

    const lastAssistantMessage = [...messages]
      .reverse()
      .find((entry) => entry.role === 'assistant')?.content;

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
      courseLookup,
      friendly: chatFriendly
    });
    const processedReply = postProcessAssistantResponse(reply, lastAssistantMessage);

    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: processedReply }]);
      setLoading(false);
    }, 200);
  }

  if (chatbotMinimized) {
    return (
      <button
        type="button"
        onClick={() => setChatbotMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2)',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 8
        }}
        title="Open Study Coach"
      >
        Study Coach
      </button>
    );
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
      <header
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong>Study Coach</strong>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Your AI Study Coach companion.</div>
        </div>
        <button
          type="button"
          onClick={() => setChatbotMinimized(true)}
          style={{
            border: '1px solid var(--surface-border)',
            borderRadius: '50%',
            width: 28,
            height: 28,
            background: '#fff',
            cursor: 'pointer',
            lineHeight: 1,
            fontSize: 18,
            padding: 0
          }}
          aria-label="Minimise Study Coach"
        >
          –
        </button>
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
