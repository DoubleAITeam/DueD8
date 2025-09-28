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
import Flashcards from '../pages/Flashcards';
import ChatbotPage from '../pages/ChatbotPage';
import SettingsPage from '../pages/Settings';
import Analytics from '../pages/Analytics';
import AnalyticsPrototype from '../pages/AnalyticsPrototype';
import QuizMaker from '../pages/QuizMaker';
import { Router, Navigate } from './router';
import { useFeatureFlags } from '../state/dashboard';
import DeliverablesV2Demo from '../pages/DeliverablesV2Demo';

const placeholder = (title: string) => <Placeholder title={title} />;

export function AppRoutes() {
  const { featureFlags } = useFeatureFlags();
  const isNewDashboard = featureFlags.newDashboard;
  const allowDeliverablesDemo = featureFlags.deliverablesV2Demo;

  const routes = useMemo(() => {
    const base = [
      { path: '/', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard/legacy', element: <LegacyDashboard /> },
      { path: '/assignments', element: <AssignmentsPage /> },
      { path: '/assignments/submit', element: placeholder('Submit Assignment') },
      { path: '/classes', element: <ClassesPage /> },
      { path: '/study-tools', element: <Navigate to="/study-tools/ai-writer" /> },
      { path: '/study-tools/ai-writer', element: <AiWriter /> },
      { path: '/study-tools/notes', element: <NoteLibrary /> },
      { path: '/study-tools/flashcards', element: <Flashcards /> },
      { path: '/study-tools/quiz-generator', element: <QuizMaker /> },
      { path: '/grades', element: <GradesPage /> },
      { path: '/analytics', element: <Analytics /> },
      { path: '/analytics/prototype', element: <AnalyticsPrototype /> },
      { path: '/grades/analytics', element: <Navigate to="/analytics" /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/workspace/assignment', element: <AssignmentWorkspace /> },
      { path: '/workspace/course', element: <CourseWorkspace /> },
      { path: '/chatbot', element: <ChatbotPage /> },
      { path: '/pricing', element: placeholder('Upgrade Plan') },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/logout', element: placeholder('Logout') },
      { path: '*', element: <Navigate to={isNewDashboard ? '/dashboard' : '/dashboard/legacy'} /> }
    ];

    if (allowDeliverablesDemo) {
      base.splice(base.length - 1, 0, { path: '/dev/deliverables-v2/demo', element: <DeliverablesV2Demo /> });
    }

    return base;
  }, [allowDeliverablesDemo, isNewDashboard]);

  return <Router routes={routes} />;
}
