import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourseData } from '../App';
import { rendererLog } from '../lib/logger';

type CourseRouteParams = {
  courseId?: string;
};

function formatDueDate(dueAt: string | null | undefined) {
  if (!dueAt) return 'No due date';
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Course() {
  const { courseId } = useParams<CourseRouteParams>();
  const navigate = useNavigate();
  const { courses, assignmentsByCourse, assignmentsLoading, loadAssignments } = useCourseData();

  const resolvedId = courseId ? Number(courseId) : NaN;
  const course = React.useMemo(
    () => courses.find((entry) => String(entry.id) === courseId),
    [courses, courseId]
  );

  const assignments = React.useMemo(() => {
    if (!course) return [];
    return assignmentsByCourse[course.id] ?? [];
  }, [assignmentsByCourse, course]);

  const loadingAssignments = course ? Boolean(assignmentsLoading[course.id]) : false;

  React.useEffect(() => {
    if (course) {
      rendererLog('nav:course_open', { courseId: course.id });
    }
  }, [course]);

  React.useEffect(() => {
    if (course && !Number.isNaN(resolvedId)) {
      loadAssignments(course.id);
    }
  }, [course, loadAssignments, resolvedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button
        type="button"
        onClick={() => navigate('/')}
        style={{
          alignSelf: 'flex-start',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '6px 12px',
          background: '#ffffff',
          cursor: 'pointer'
        }}
      >
        ← Back to Dashboard
      </button>
      {course ? (
        <>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ margin: 0 }}>{course.name}</h1>
            <p style={{ margin: 0, color: '#64748b' }}>{course.course_code ?? 'Course overview'}</p>
          </header>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Assignments</h2>
            {loadingAssignments ? (
              <p style={{ margin: 0, color: '#64748b' }}>Loading assignments...</p>
            ) : assignments.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {assignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => navigate(`/assignment/${assignment.id}`)}
                    style={{
                      textAlign: 'left',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '16px 20px',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{assignment.name}</span>
                    <span style={{ fontSize: 13, color: '#475569' }}>
                      Due {formatDueDate(assignment.due_at)} · Status:{' '}
                      {assignment.status ? assignment.status : 'Open'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>No assignments available yet.</p>
            )}
          </section>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Course not found</h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            We couldn't locate that course. Try returning to the dashboard to choose another one.
          </p>
        </div>
      )}
    </div>
  );
}
