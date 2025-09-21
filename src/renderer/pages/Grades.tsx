import React, { useMemo } from 'react';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from '../routes/router';
import { useDashboardData, useRawCourses, useCourses } from '../state/dashboard';
import { deriveCourseGrade } from '../../lib/gradeUtils';
import { useStore } from '../state/store';

function extractSyllabusParagraphs(html: string | null | undefined) {
  if (!html) return [] as string[];
  let textContent = '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    textContent = doc.body?.textContent ?? '';
  } catch (error) {
    textContent = html.replace(/<[^>]+>/g, ' ');
  }

  return textContent
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length);
}

export default function GradesPage() {
  const { status } = useDashboardData();
  const rawCourses = useRawCourses();
  const progress = useCourses();
  const setView = useStore((state) => state.setView);
  const navigate = useNavigate();

  const gradeSummaries = useMemo(
    () =>
      rawCourses.map((course) => ({
        course,
        summary: deriveCourseGrade(course),
        progress: progress.find((entry) => entry.id === String(course.id))
      })),
    [rawCourses, progress]
  );

  const numericScores = gradeSummaries
    .map((item) => item.summary.score)
    .filter((score): score is number => typeof score === 'number');
  const averageScore =
    numericScores.length > 0
      ? numericScores.reduce((total, value) => total + value, 0) / numericScores.length
      : null;

  const completedCourses = gradeSummaries.filter((item) => item.summary.status === 'complete').length;

  return (
    <AppShell pageTitle="Grades">
      <div className="page-stack">
        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Performance overview</h3>
          </div>
          <div className="grades-overview">
            <div className="grades-overview__metric">
              <span>Courses tracked</span>
              <strong>{rawCourses.length}</strong>
            </div>
            <div className="grades-overview__metric">
              <span>Courses with final grades</span>
              <strong>{completedCourses}</strong>
            </div>
            <div className="grades-overview__metric">
              <span>Average score</span>
              <strong>{averageScore != null ? `${averageScore.toFixed(1)}%` : '—'}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Course breakdown</h3>
          </div>
          {status === 'loading' && gradeSummaries.length === 0 ? (
            <p className="dashboard-card__empty">Loading grades…</p>
          ) : gradeSummaries.length === 0 ? (
            <p className="dashboard-card__empty">No course information available.</p>
          ) : (
            <ul className="grades-list">
              {gradeSummaries.map(({ course, summary, progress: courseProgress }) => (
                <li key={course.id} className="grades-list__item">
                  <div className="grades-list__header">
                    <button
                      type="button"
                      className="grades-list__link"
                      onClick={() => {
                        setView({ screen: 'course', courseId: course.id });
                        navigate('/workspace/course');
                      }}
                    >
                      {course.name}
                    </button>
                    <span>{course.course_code ?? 'No course code'}</span>
                  </div>
                  <div className="grades-list__details">
                    <div>
                      <span className="grades-list__label">Grade</span>
                      <strong>{summary.display}</strong>
                    </div>
                    <div>
                      <span className="grades-list__label">Assignments complete</span>
                      <div className="grades-list__value">
                        {courseProgress ? (
                          <>
                            <span>{courseProgress.completedAssignments}</span>
                            <span className="grades-list__value-divider">/</span>
                            <span>{courseProgress.totalAssignments}</span>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {course.syllabus_body ? (
                    <details className="grades-list__syllabus">
                      <summary>View syllabus insights</summary>
                      <div className="grades-list__syllabus-body">
                        {(() => {
                          const paragraphs = extractSyllabusParagraphs(course.syllabus_body);
                          if (!paragraphs.length) {
                            return <p>No syllabus details available.</p>;
                          }
                          return paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>);
                        })()}
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
