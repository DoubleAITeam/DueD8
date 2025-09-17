import React from 'react';
import type { Course } from '../../lib/canvasClient';

type Props = {
  courses: Course[];
  loading?: boolean;
  onSelect?: (course: Course) => void;
};

export default function CoursesGrid({ courses, loading, onSelect }: Props) {
  if (loading) return <p>Loading courses...</p>;
  if (!courses?.length) return <p>No active courses.</p>;

  const interactive = typeof onSelect === 'function';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {courses.map((course) => (
        <button
          type="button"
          key={course.id}
          onClick={interactive ? () => onSelect(course) : undefined}
          disabled={!interactive}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 16,
            background: '#f8fafc',
            textAlign: 'left',
            cursor: interactive ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            color: '#0f172a'
          }}
        >
          <div style={{ fontWeight: 600 }}>{course.name}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>{course.course_code ?? 'No course code'}</div>
        </button>
      ))}
    </div>
  );
}
