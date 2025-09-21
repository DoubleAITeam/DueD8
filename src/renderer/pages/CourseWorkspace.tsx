import React, { useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import AssignmentsList from '../components/AssignmentsList';
import {
  useDashboardData,
  useCourseById,
  useUpcomingAssignments,
  usePastAssignments
} from '../state/dashboard';
import { useStore } from '../state/store';
import { useNavigate } from '../routes/router';
import { deriveCourseGrade } from '../../lib/gradeUtils';
import type { Assignment } from '../../lib/canvasClient';

function groupAssignments(assignments: Assignment[], courseId: number | null) {
  if (!courseId) return [];
  return assignments
    .filter((assignment) => assignment.course_id === courseId)
    .sort((a, b) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
}

export default function CourseWorkspace() {
  const { status } = useDashboardData();
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const navigate = useNavigate();

  const courseId = view.screen === 'course' ? view.courseId : null;
  const course = useCourseById(courseId);

  const upcomingAssignments = groupAssignments(useUpcomingAssignments(), courseId);
  const pastAssignments = groupAssignments(usePastAssignments(), courseId);

  const gradeSummary = useMemo(() => (course ? deriveCourseGrade(course) : null), [course]);

  const loading = status === 'loading' && !course;

  function handleBack() {
    setView({ screen: 'dashboard' });
    navigate('/classes');
  }

  return (
    <AppShell pageTitle="Course Workspace">
      <div className="workspace">
        <div className="workspace__header">
          <button type="button" className="workspace__back" onClick={handleBack}>
            ← Back to classes
          </button>
          {course ? (
            <div className="workspace__summary">
              <h2>{course.name}</h2>
              <p className="workspace__course-code">{course.course_code ?? 'No course code provided'}</p>
            </div>
          ) : null}
        </div>

        <section className="workspace__card">
          {loading ? (
            <p className="dashboard-card__empty">Loading course information…</p>
          ) : course ? (
            <div className="course-workspace__details">
              <div className="course-workspace__metric">
                <span>Current grade</span>
                <strong>{gradeSummary?.display ?? 'In progress'}</strong>
              </div>
              <div className="course-workspace__metric">
                <span>Upcoming assignments</span>
                <strong>{upcomingAssignments.length}</strong>
              </div>
              <div className="course-workspace__metric">
                <span>Completed assignments</span>
                <strong>{pastAssignments.length}</strong>
              </div>
            </div>
          ) : (
            <div className="workspace__placeholder">
              <h3>Select a course</h3>
              <p>Choose a class from the classes page to open its workspace.</p>
              <button type="button" className="workspace__back" onClick={() => navigate('/classes')}>
                Browse classes
              </button>
            </div>
          )}
        </section>

        {course ? (
          <section className="workspace__card">
            <div className="dashboard-card__header">
              <h3>Upcoming assignments</h3>
            </div>
            <AssignmentsList
              assignments={upcomingAssignments}
              courseLookup={{ [course.id]: course.course_code || course.name }}
              loading={status === 'loading' && upcomingAssignments.length === 0}
              emptyMessage="No upcoming assignments for this course."
              onSelect={(assignment) => {
                setView({ screen: 'assignment', courseId: assignment.course_id, assignmentId: assignment.id });
                navigate('/workspace/assignment');
              }}
            />
          </section>
        ) : null}

        {course ? (
          <section className="workspace__card">
            <div className="dashboard-card__header">
              <h3>Past assignments</h3>
            </div>
            <AssignmentsList
              assignments={pastAssignments}
              courseLookup={{ [course.id]: course.course_code || course.name }}
              loading={status === 'loading' && pastAssignments.length === 0}
              emptyMessage="No completed assignments recorded yet."
              onSelect={(assignment) => {
                setView({ screen: 'assignment', courseId: assignment.course_id, assignmentId: assignment.id });
                navigate('/workspace/assignment');
              }}
            />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
