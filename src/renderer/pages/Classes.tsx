import React, { useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useCourses,
  useDashboardData,
  useRawCourses,
  useUpcomingAssignments
} from '../state/dashboard';
import { useStore } from '../state/store';
import { useNavigate } from '../routes/router';
import { deriveCourseGrade } from '../../lib/gradeUtils';
import type { Assignment } from '../../lib/canvasClient';

function nextAssignmentsForCourse(assignments: Assignment[], courseId: number) {
  return assignments
    .filter((assignment) => assignment.course_id === courseId && assignment.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, 3);
}

export default function ClassesPage() {
  const { status } = useDashboardData();
  const rawCourses = useRawCourses();
  const courseProgress = useCourses();
  const upcomingAssignments = useUpcomingAssignments();
  const navigate = useNavigate();
  const setView = useStore((state) => state.setView);

  const progressLookup = useMemo(() => {
    const lookup = new Map<string, typeof courseProgress[number]>();
    courseProgress.forEach((progress) => lookup.set(progress.id, progress));
    return lookup;
  }, [courseProgress]);

  return (
    <AppShell pageTitle="Classes">
      <div className="page-stack">
        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Active courses</h3>
            <span className="classes-summary__count">{rawCourses.length} total</span>
          </div>
          <div className="class-grid">
            {status === 'loading' && rawCourses.length === 0 ? (
              <p className="dashboard-card__empty">Loading classes…</p>
            ) : rawCourses.length === 0 ? (
              <p className="dashboard-card__empty">No active courses available.</p>
            ) : (
              rawCourses.map((course) => {
                const grade = deriveCourseGrade(course);
                const progress = progressLookup.get(String(course.id));
                const upcoming = nextAssignmentsForCourse(upcomingAssignments, course.id);

                return (
                  <article key={course.id} className="class-card">
                    <header className="class-card__header">
                      <div>
                        <h3>{course.name}</h3>
                        <p>{course.course_code ?? 'No course code provided'}</p>
                      </div>
                      <div className={`class-card__grade class-card__grade--${grade.status}`}>
                        <span className="class-card__grade-label">Current grade</span>
                        <strong>{grade.display}</strong>
                      </div>
                    </header>
                    <footer className="class-card__footer">
                      <button
                        type="button"
                        onClick={() => {
                          setView({ screen: 'course', courseId: course.id });
                          navigate('/workspace/course');
                        }}
                      >
                        View course workspace
                      </button>
                    </footer>
                    <div className="class-card__body">
                      <div className="class-card__metric">
                        <span>Assignments completed</span>
                        <strong>
                          {progress ? `${progress.completedAssignments}/${progress.totalAssignments}` : '—'}
                        </strong>
                      </div>
                      <div className="class-card__upcoming">
                        <span>Upcoming assignments</span>
                        {upcoming.length === 0 ? (
                          <p>No upcoming assignments.</p>
                        ) : (
                          <ul>
                            {upcoming.map((assignment) => (
                              <li key={assignment.id}>
                                <strong>{assignment.name}</strong>
                                <span>
                                  Due{' '}
                                  {assignment.due_at
                                    ? new Date(assignment.due_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric'
                                      })
                                    : 'TBD'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
