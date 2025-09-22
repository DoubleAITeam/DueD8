import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Assignment, Course } from '../../lib/canvasClient';
import type { AssignmentContextEntry, ViewState } from '../state/store';
import { useStore } from '../state/store';
import { featureFlags } from '../../shared/featureFlags';
import { deriveCourseGrade } from '../../lib/gradeUtils';
import { useAiUsageStore, estimateTokensFromText } from '../state/aiUsage';
import AiTokenBadge from './ui/AiTokenBadge';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Props = {
  view: ViewState;
  profileName?: string;
  courses: Course[];
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

type StudentProfile = {
  preferredName?: string;
  academicGoal?: string;
  confidentCourse?: string;
  challengeCourse?: string;
  studyHabits?: string;
  supportNeeds?: string;
};

type ProfileQuestion = {
  key: keyof StudentProfile;
  prompt: string;
  acknowledgement: (answer: string, profile: StudentProfile) => string;
};

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    key: 'preferredName',
    prompt: 'To personalise things, what name would you like me to use when we chat?',
    acknowledgement: (answer) => {
      const chosen = answer.trim() || 'friend';
      return `Thanks! I'll call you ${chosen}.`;
    }
  },
  {
    key: 'academicGoal',
    prompt: 'What academic goal are you most focused on this term—GPA, mastering a course, something else?',
    acknowledgement: (answer) => `Great, keeping "${answer.trim()}" in mind will help me prioritise your plan.`
  },
  {
    key: 'confidentCourse',
    prompt: 'Which course or subject feels most in your control right now?',
    acknowledgement: (answer) =>
      answer.trim()
        ? `Love that you feel confident in ${answer.trim()}. We can use it as a momentum booster.`
        : 'Got it—confidence levels noted.'
  },
  {
    key: 'challengeCourse',
    prompt: 'Which course tends to demand the most energy so I can keep an eye on it for you?',
    acknowledgement: (answer) =>
      answer.trim()
        ? `I’ll make sure we keep ${answer.trim()} on the radar.`
        : 'Alright, I’ll still watch for the toughest spots.'
  },
  {
    key: 'studyHabits',
    prompt: 'How do you prefer to schedule your work—short daily sessions, weekend sprints, study groups?',
    acknowledgement: (answer) =>
      answer.trim()
        ? `Noted—${answer.trim()} helps me shape suggestions that actually fit your rhythm.`
        : 'Flexible approach noted. We can iterate together.'
  },
  {
    key: 'supportNeeds',
    prompt: 'Any upcoming exams, projects, or specific support you want me to be proactive about?',
    acknowledgement: (answer) =>
      answer.trim()
        ? `Thanks for sharing. I’ll keep "${answer.trim()}" front and centre.`
        : 'All good—I’ll surface anything urgent as it appears.'
  }
];

const LETTER_GRADE_TO_SCORE: Record<string, number> = {
  'A+': 98,
  A: 95,
  'A-': 91,
  'B+': 88,
  B: 85,
  'B-': 81,
  'C+': 78,
  C: 75,
  'C-': 71,
  'D+': 68,
  D: 65,
  'D-': 61,
  F: 50
};

function letterToScore(letter?: string) {
  if (!letter) return null;
  const normalised = letter.trim().toUpperCase();
  return LETTER_GRADE_TO_SCORE[normalised] ?? null;
}

function summariseStudentProfile(profile: StudentProfile) {
  const lines: string[] = [];
  if (profile.academicGoal) {
    lines.push(`• Goal: ${profile.academicGoal}`);
  }
  if (profile.confidentCourse) {
    lines.push(`• Confident in: ${profile.confidentCourse}`);
  }
  if (profile.challengeCourse) {
    lines.push(`• Needs extra focus: ${profile.challengeCourse}`);
  }
  if (profile.studyHabits) {
    lines.push(`• Preferred routine: ${profile.studyHabits}`);
  }
  if (profile.supportNeeds) {
    lines.push(`• Watch-outs: ${profile.supportNeeds}`);
  }
  if (!lines.length) {
    return '';
  }
  return `Here’s what I noted about you:\n${lines.join('\n')}`;
}

function rankCourseGrades(
  courses: Course[],
  comparator: (candidate: number | null, currentBest: number | null) => boolean
) {
  let selected: { course: Course; display: string; scoreValue: number | null } | null = null;
  courses.forEach((course) => {
    const summary = deriveCourseGrade(course);
    if (summary.status !== 'complete') return;
    const score = typeof summary.score === 'number' ? summary.score : letterToScore(summary.grade);
    const scoreValue = typeof score === 'number' && !Number.isNaN(score) ? score : null;
    const display = summary.display;
    if (!selected) {
      selected = { course, display, scoreValue };
      return;
    }
    if (comparator(scoreValue, selected.scoreValue)) {
      selected = { course, display, scoreValue };
    }
  });
  return selected;
}

function findBestCourseGrade(courses: Course[]) {
  return rankCourseGrades(courses, (candidate, currentBest) => {
    const candidateValue = candidate ?? -Infinity;
    const currentBestValue = currentBest ?? -Infinity;
    return candidateValue > currentBestValue;
  });
}

function findLowestCourseGrade(courses: Course[]) {
  return rankCourseGrades(courses, (candidate, currentBest) => {
    const candidateValue = candidate ?? Infinity;
    const currentBestValue = currentBest ?? Infinity;
    return candidateValue < currentBestValue;
  });
}

function answerSpecialQuestion(options: {
  message: string;
  courses: Course[];
  studentProfile: StudentProfile;
  profileName?: string;
}) {
  const { message, courses, studentProfile, profileName } = options;
  const lowered = message.toLowerCase();

  if (/(best|highest).*(grade|score)/.test(lowered)) {
    const best = findBestCourseGrade(courses);
    if (!best) {
      return 'Canvas has not shared any current grades yet, but we can still map out upcoming work to keep every course in a strong position.';
    }
    const nickname = studentProfile.preferredName?.trim() || profileName?.split(' ')[0] || '';
    return `Right now your strongest course looks like ${best.course.name} at ${best.display}. Brilliant work${
      nickname ? `, ${nickname}` : ''
    }—let’s keep that momentum going.`;
  }

  if (/(worst|lowest).*(grade|score)/.test(lowered)) {
    if (!courses.length) {
      return 'I do not see any Canvas courses synced yet, so let’s reconnect to gather real-time grade details.';
    }
    const nickname = studentProfile.preferredName?.trim() || profileName?.split(' ')[0] || '';
    const toughest = findLowestCourseGrade(courses);
    if (!toughest) {
      return `Canvas has not posted updated grades yet${nickname ? `, ${nickname}` : ''}, but I can still help you prioritise assignments so nothing catches you off guard.`;
    }
    return `The course needing the most attention appears to be ${toughest.course.name} at ${toughest.display}. Let’s plan extra checkpoints and study blocks there.`;
  }

  if (/(what|tell).*(you know).*me/.test(lowered)) {
    const summary = summariseStudentProfile(studentProfile);
    if (!summary) {
      return 'I’m still collecting your preferences. Share a bit about your goals, study habits, and any tough courses so I can tailor my guidance.';
    }
    return `${summary}\n\nIf anything changes, just let me know and I’ll update it.`;
  }

  if (/thank/.test(lowered)) {
    const nickname = studentProfile.preferredName?.trim() || profileName?.split(' ')[0] || '';
    return `Always happy to help${nickname ? `, ${nickname}` : ''}! Ready when you need me again.`;
  }

  return null;
}

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
  studentProfile: StudentProfile;
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
    studentProfile,
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
  const primaryName = studentProfile.preferredName?.trim() || profileName?.split(' ')[0];
  const firstName = primaryName?.split(' ')[0];

  if (friendly && GREETING_KEYWORDS.has(lowered)) {
    const targetName = firstName ? (firstName.toLowerCase() === 'ahmed' ? 'Ahmed' : firstName) : 'there';
    return `Hi ${targetName}! I'm DueD8 Study Coach—ready whenever you want to plan, prioritise, or ask a question.`;
  }

  const sections: string[] = [];
  if (friendly) {
    sections.push(`Hey${firstName ? ` ${firstName}` : ''}, keeping your goals in mind, let’s dig into “${trimmedMessage}.”`);
  } else {
    sections.push(`You asked: "${trimmedMessage}"`);
  }

  if (studentProfile.academicGoal) {
    sections.push(`Goal check-in: ${studentProfile.academicGoal}.`);
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
      studentProfile.studyHabits
        ? `Match your ${studentProfile.studyHabits.toLowerCase()} routine to this assignment by locking in the first work session.`
        : 'Outline the key deliverables before you start drafting.',
      'Block time for a rough pass and a final review.',
      studentProfile.supportNeeds
        ? `Cross-check any notes about ${studentProfile.supportNeeds.toLowerCase()} so nothing slips.`
        : 'Note any unclear expectations so we can clarify them early.'
    ];
    sections.push(`Next steps to keep momentum:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  } else if (view.screen === 'course' && selectedCourse) {
    sections.push(`Course spotlight: ${selectedCourse.name}.`);
    sections.push('Upcoming work:');
    sections.push(formatAssignmentsSummary(courseAssignments, courseLookup));
    const actionItems = [
      'Skim the syllabus or notes for this week.',
      'Plan study blocks around the nearest deadline.',
      studentProfile.challengeCourse && selectedCourse.name.toLowerCase().includes(studentProfile.challengeCourse.toLowerCase())
        ? `Add an extra checkpoint for ${studentProfile.challengeCourse} so it stays manageable.`
        : 'Flag topics that still feel shaky so we can review them.'
    ];
    sections.push(`Quick wins:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  } else {
    sections.push('Here is what’s on your radar next:');
    sections.push(formatAssignmentsSummary(upcomingAssignments, courseLookup));
    const actionItems = [
      studentProfile.studyHabits
        ? `Blend your ${studentProfile.studyHabits.toLowerCase()} approach with the top deadline.`
        : 'Choose the most urgent task and start there.',
      'Balance high-effort and quick wins through the week.',
      studentProfile.supportNeeds
        ? `Schedule reminders related to ${studentProfile.supportNeeds.toLowerCase()}.`
        : 'Set checkpoints so nothing sneaks up on you.'
    ];
    sections.push(`Game plan ideas:\n${actionItems.map((item) => `• ${item}`).join('\n')}`);
  }

  sections.push('Ask me for a timeline, resource suggestions, or a deeper breakdown anytime.');
  return sections.join('\n\n');
}

export default function ChatbotPanel({
  view,
  profileName,
  courses,
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
  const registerAiTask = useAiUsageStore((state) => state.registerTask);
  const chatFriendly = featureFlags.chatFriendliness;
  const [studentProfile, setStudentProfile] = useState<StudentProfile>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const profileComplete = questionIndex >= PROFILE_QUESTIONS.length;
  const preferredName = studentProfile.preferredName?.trim() || profileName;
  const baseGreeting = chatFriendly
    ? `Hi${preferredName ? ` ${preferredName}` : ''}! I'm DueD8 Study Coach—here whenever you need a study boost.`
    : `Hi${preferredName ? ` ${preferredName}` : ''}! I'm your DueD8 study coach.`;
  const introMessage = !profileComplete && PROFILE_QUESTIONS[0]
    ? `${baseGreeting}\n\nBefore we dive in, I’d love to learn a few things so my guidance feels personal. ${PROFILE_QUESTIONS[0].prompt}`
    : `${baseGreeting}\n\nThanks for sharing your study preferences—ask me anything when you’re ready.`;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: introMessage
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0].role !== 'assistant') return prev;
      const next = [...prev];
      const updatedIntro = !profileComplete && questionIndex === 0 && PROFILE_QUESTIONS[0]
        ? `${baseGreeting}\n\nBefore we dive in, I’d love to learn a few things so my guidance feels personal. ${PROFILE_QUESTIONS[0].prompt}`
        : profileComplete
          ? `${baseGreeting}\n\nThanks for sharing your study preferences—ask me anything when you’re ready.`
          : baseGreeting;
      next[0] = {
        role: 'assistant',
        content: updatedIntro
      };
      return next;
    });
  }, [profileName, baseGreeting, profileComplete, questionIndex]);

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

  const chatTokenEstimate = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    const promptTokens = estimateTokensFromText(trimmed) + 120;
    const expectedReply = Math.max(200, Math.round(promptTokens * 0.75));
    return promptTokens + expectedReply;
  }, [input]);

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

    if (!profileComplete) {
      const currentIndex = Math.min(questionIndex, PROFILE_QUESTIONS.length - 1);
      const currentQuestion = PROFILE_QUESTIONS[currentIndex];
      const updatedProfile: StudentProfile = {
        ...studentProfile,
        [currentQuestion.key]: trimmed
      };
      setStudentProfile(updatedProfile);
      const acknowledgement = currentQuestion.acknowledgement(trimmed, updatedProfile);
      setQuestionIndex((prev) => prev + 1);

      const nextQuestion = PROFILE_QUESTIONS[currentIndex + 1];
      const summary = summariseStudentProfile(updatedProfile);
      const summarySection = summary ? `\n\n${summary}` : '';
      const followUp = nextQuestion
        ? `${acknowledgement}\n\n${nextQuestion.prompt}`
        : `${acknowledgement}${summarySection}\n\nThat’s everything I need to personalise our chats—ask me anything about your courses or workload.`;

      const intakePromptTokens = estimateTokensFromText(trimmed);
      const intakeReplyTokens = estimateTokensFromText(followUp);
      window.setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: followUp }]);
        setLoading(false);
        registerAiTask({
          label: 'Study Coach profile intake',
          category: 'chat',
          steps: [
            { label: 'Understand response', tokenEstimate: intakePromptTokens },
            { label: 'Compose follow-up', tokenEstimate: intakeReplyTokens }
          ],
          metadata: {
            stage: 'profile-intake',
            questionKey: currentQuestion.key
          }
        });
      }, 200);
      return;
    }

    const special = answerSpecialQuestion({ message: trimmed, courses, studentProfile, profileName });
    const reply = special
      ? special
      : composeAssistantResponse({
          view,
          message: trimmed,
          profileName,
          studentProfile,
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

    const promptTokens = estimateTokensFromText(trimmed) + 120;
    const replyTokens = estimateTokensFromText(processedReply);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: processedReply }]);
      setLoading(false);
      registerAiTask({
        label: 'Study Coach chat',
        category: 'chat',
        steps: [
          { label: 'Process prompt', tokenEstimate: promptTokens },
          { label: 'Draft response', tokenEstimate: replyTokens }
        ],
        metadata: {
          context: view.screen,
          courseId: selectedCourse?.id,
          assignmentId: selectedAssignment?.id
        }
      });
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
        {chatTokenEstimate ? <AiTokenBadge category="chat" tokens={chatTokenEstimate} /> : null}
      </form>
    </aside>
  );
}
