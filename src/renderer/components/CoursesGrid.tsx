import React from 'react';
import type { Course } from '../../lib/canvasClient';

type Props = {
  courses: Course[];
  loading?: boolean;
};

export default function CoursesGrid({ courses, loading }: Props) {
  if (loading) return <p>Loading courses...</p>;
  if (!courses?.length) return <p>No active courses.</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {courses.map((course) => (
        <div
          key={course.id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 16,
            background: '#f8fafc'
          }}
        >
          <div style={{ fontWeight: 600 }}>{course.name}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>{course.course_code ?? 'No course code'}</div>
        </div>
      ))}
    </div>
  );
}
