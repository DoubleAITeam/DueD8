import React, { useMemo } from 'react';
import DashboardNew from '../pages/DashboardNew';
import LegacyDashboard from '../pages/Dashboard';
import AssignmentsPage from '../pages/Assignments';
import ClassesPage from '../pages/Classes';
import CalendarPage from '../pages/CalendarPage';
import GradesPage from '../pages/Grades';
import AssignmentWorkspace from '../pages/AssignmentWorkspace';
import CourseWorkspace from '../pages/CourseWorkspace';
import Placeholder from '../pages/Placeholder';
import AiWriter from '../pages/AiWriter';
import NoteLibrary from '../pages/NoteLibrary';
import ChatbotPage from '../pages/ChatbotPage';
import SettingsPage from '../pages/Settings';
import Analytics from '../pages/Analytics';
import AnalyticsPrototype from '../pages/AnalyticsPrototype';
import { Router, Navigate } from './router';
import { useFeatureFlags } from '../state/dashboard';
import { useStore } from '../state/store';
import { AI_RESET_BANNER_MESSAGE, isAiActionBlocked } from '../../shared/aiConfig';

const placeholder = (title: string) => <Placeholder title={title} />;

export function AppRoutes() {
  const { featureFlags } = useFeatureFlags();
  const isNewDashboard = featureFlags.newDashboard;
  const aiResetState = useStore((s) => s.aiResetState);
  const aiBlocked = isAiActionBlocked(aiResetState);

  const gated = (element: JSX.Element) => (aiBlocked ? <AiFeatureDisabled message={aiResetState?.bannerMessage} /> : element);

  const routes = useMemo(
    () => [
      { path: '/', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard/legacy', element: <LegacyDashboard /> },
      { path: '/assignments', element: <AssignmentsPage /> },
      { path: '/assignments/submit', element: placeholder('Submit Assignment') },
      { path: '/classes', element: <ClassesPage /> },
      { path: '/study-tools', element: <Navigate to="/study-tools/ai-writer" /> },
      { path: '/study-tools/ai-writer', element: gated(<AiWriter />) },
      { path: '/study-tools/notes', element: <NoteLibrary /> },
      { path: '/study-tools/flashcards', element: gated(placeholder('Flashcards')) },
      { path: '/study-tools/quiz-generator', element: gated(placeholder('Quiz Generator')) },
      { path: '/grades', element: <GradesPage /> },
      { path: '/analytics', element: <Analytics /> },
      { path: '/analytics/prototype', element: <AnalyticsPrototype /> },
      { path: '/grades/analytics', element: <Navigate to="/analytics" /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/workspace/assignment', element: <AssignmentWorkspace /> },
      { path: '/workspace/course', element: <CourseWorkspace /> },
      { path: '/chatbot', element: gated(<ChatbotPage />) },
      { path: '/pricing', element: placeholder('Upgrade Plan') },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/logout', element: placeholder('Logout') },
      { path: '*', element: <Navigate to={isNewDashboard ? '/dashboard' : '/dashboard/legacy'} /> }
    ],
    [aiBlocked, aiResetState?.bannerMessage, isNewDashboard]
  );

  return <Router routes={routes} />;
}

function AiFeatureDisabled({ message }: { message?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '2rem',
        textAlign: 'center'
      }}
    >
      <h2 style={{ marginBottom: '0.75rem' }}>AI temporarily unavailable</h2>
      <p style={{ maxWidth: 420, color: 'var(--text-secondary)' }}>
        {message || AI_RESET_BANNER_MESSAGE}
      </p>
    </div>
  );
}
