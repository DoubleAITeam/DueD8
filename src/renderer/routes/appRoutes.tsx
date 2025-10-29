import React, { useMemo } from 'react';
import { Navigate, RouterView } from './router';
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
import { useFeatureFlags } from '../state/dashboard';
import { useAiRuntimeState, selectAiBannerMessage, selectIsAiFrozen } from '../state/ai';

const placeholder = (title: string, options?: { ai?: boolean }) => (
  <Placeholder title={title} aiEnabled={options?.ai} />
);

export function AppRoutes() {
  const { featureFlags } = useFeatureFlags();
  const isNewDashboard = featureFlags.newDashboard;
  const isAiFrozen = useAiRuntimeState(selectIsAiFrozen);
  const aiBannerMessage = useAiRuntimeState(selectAiBannerMessage);

  const gated = (element: JSX.Element) =>
    isAiFrozen ? <AiFeatureDisabled message={aiBannerMessage} /> : element;

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
      { path: '/study-tools/flashcards', element: placeholder('Flashcards', { ai: true }) },
      { path: '/study-tools/quiz-generator', element: placeholder('Quiz Generator', { ai: true }) },
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
    [aiBannerMessage, isAiFrozen, isNewDashboard]
  );

  return <RouterView routes={routes} />;
}

function AiFeatureDisabled({ message }: { message: string }) {
  const resolved = message || 'AI is regenerating. Please wait until green.';
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
      <p style={{ maxWidth: 420, color: 'var(--text-secondary)' }}>{resolved}</p>
    </div>
  );
}
