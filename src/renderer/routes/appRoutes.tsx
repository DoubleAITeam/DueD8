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
import { Router, Navigate } from './router';
import { useFeatureFlags } from '../state/dashboard';

const placeholder = (title: string) => <Placeholder title={title} />;

export function AppRoutes() {
  const { featureFlags } = useFeatureFlags();
  const isNewDashboard = featureFlags.newDashboard;

  const routes = useMemo(
    () => [
      { path: '/', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard', element: isNewDashboard ? <DashboardNew /> : <Navigate to="/dashboard/legacy" /> },
      { path: '/dashboard/legacy', element: <LegacyDashboard /> },
      { path: '/assignments', element: <AssignmentsPage /> },
      { path: '/assignments/submit', element: placeholder('Submit Assignment') },
      { path: '/classes', element: <ClassesPage /> },
      { path: '/study-tools', element: <Navigate to="/study-tools/ai-writer" replace /> },
      { path: '/study-tools/ai-writer', element: <AiWriter /> },
      { path: '/study-tools/notes', element: <NoteLibrary /> },
      { path: '/study-tools/flashcards', element: placeholder('Flashcards') },
      { path: '/study-tools/quiz-generator', element: placeholder('Quiz Generator') },
      { path: '/grades', element: <GradesPage /> },
      { path: '/grades/analytics', element: placeholder('Analytics') },
      { path: '/analytics', element: <Navigate to="/grades/analytics" replace /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/workspace/assignment', element: <AssignmentWorkspace /> },
      { path: '/workspace/course', element: <CourseWorkspace /> },
      { path: '/chatbot', element: placeholder('Chatbot') },
      { path: '/pricing', element: placeholder('Upgrade Plan') },
      { path: '/settings', element: placeholder('Settings') },
      { path: '/logout', element: placeholder('Logout') },
      { path: '*', element: <Navigate to={isNewDashboard ? '/dashboard' : '/dashboard/legacy'} /> }
    ],
    [isNewDashboard]
  );

  return <Router routes={routes} />;
}
