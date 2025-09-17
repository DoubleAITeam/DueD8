import React from 'react';
import type { Course } from '../../lib/canvasClient';
import { deriveCourseGrade } from '../../lib/gradeUtils';

type Props = {
  courses: Course[];
  loading?: boolean;
  onSelectCourse?: (course: Course) => void;
};

export default function CoursesGrid({ courses, loading, onSelectCourse }: Props) {
  if (loading) return <p>Loading courses...</p>;
  if (!courses?.length) return <p>No active courses.</p>;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16
      }}
    >
      {courses.map((course) => (
        <div
          key={course.id}
          style={{
            /* PHASE 1: Update course tiles to match flat card language. */
            border: '1px solid var(--surface-border)',
            borderRadius: 16,
            padding: 18,
            background: 'rgba(255,255,255,0.75)',
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)',
            cursor: onSelectCourse ? 'pointer' : 'default'
          }}
          // PHASE 2: Allow tapping a course to drill down for contextual prompts later.
          onClick={onSelectCourse ? () => onSelectCourse(course) : undefined}
        >
          {(() => {
            const grade = deriveCourseGrade(course);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 600, flex: 1 }}>{course.name}</div>
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--surface-border)',
                    background: grade.status === 'complete' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                    color: grade.status === 'complete' ? '#047857' : 'var(--text-secondary)'
                  }}
                >
                  {/* PHASE 4: Present the latest grade beside each course. */}
                  {grade.display}
                </span>
              </div>
            );
          })()}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{course.course_code ?? 'No course code'}</div>
        </div>
      ))}
    </div>
  );
}
