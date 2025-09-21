import React, { useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import AssignmentDetail from './AssignmentDetail';
import {
  useDashboardData,
  useAssignmentById,
  useCourseById,
  useUpcomingAssignments,
  usePastAssignments
} from '../state/dashboard';
import { useStore } from '../state/store';
import { useNavigate } from '../routes/router';

export default function AssignmentWorkspace() {
  const { status } = useDashboardData();
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const navigate = useNavigate();

  const assignmentId = view.screen === 'assignment' ? view.assignmentId : null;
  const courseId = view.screen === 'assignment' ? view.courseId : null;

  const assignment = useAssignmentById(assignmentId);
  const course = useCourseById(courseId);

  // Ensure lists are initialised so AssignmentDetail has access to contexts and attachments.
  useUpcomingAssignments();
  usePastAssignments();

  const courseName = useMemo(() => {
    if (!course) return undefined;
    return course.course_code || course.name;
  }, [course]);

  const loading = status === 'loading' && !assignment;

  function handleBack() {
    setView({ screen: 'dashboard' });
    navigate('/assignments');
  }

  return (
    <AppShell pageTitle="Assignment Workspace">
      <div className="workspace">
        <div className="workspace__header">
          <button type="button" className="workspace__back" onClick={handleBack}>
            ← Back to assignments
          </button>
          {assignment ? (
            <div className="workspace__summary">
              <h2>{assignment.name}</h2>
              <p>
                {courseName ? <span className="workspace__course">{courseName}</span> : null}
                {assignment.due_at ? (
                  <span className="workspace__due">
                    Due {new Date(assignment.due_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="workspace__due">No due date provided</span>
                )}
              </p>
            </div>
          ) : null}
        </div>

        <section className="workspace__card">
          {loading ? (
            <p className="dashboard-card__empty">Loading assignment details…</p>
          ) : assignment ? (
            <AssignmentDetail
              assignment={assignment}
              courseName={courseName}
              onBack={handleBack}
              backLabel="Back to assignments"
            />
          ) : (
            <div className="workspace__placeholder">
              <h3>Select an assignment</h3>
              <p>
                Choose an assignment from the assignments page to open it in this workspace.
              </p>
              <button type="button" className="workspace__back" onClick={() => navigate('/assignments')}>
                Browse assignments
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
