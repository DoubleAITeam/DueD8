import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourseData } from '../App';
import { useUIStore } from '../state/uiStore';

export default function Dashboard() {
  const unreadCount = useUIStore((state) => state.unreadCount);
  const incUnread = useUIStore((state) => state.incUnread);
  const navigate = useNavigate();
  const { courses, loadingCourses } = useCourseData();

  const handleCourseClick = React.useCallback(
    (courseId: number) => {
      navigate(`/course/${courseId}`);
    },
    [navigate]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Welcome to DueD8. This area will soon surface your upcoming coursework and quick actions.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#f1f5f9',
          borderRadius: 12,
          padding: '16px 20px',
          color: '#0f172a'
        }}
      >
        <span style={{ fontWeight: 600 }}>Unread Assistant Messages:</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 32,
          padding: '4px 10px',
          borderRadius: 999,
          background: unreadCount > 0 ? '#4338ca' : '#cbd5f5',
          color: unreadCount > 0 ? '#f8fafc' : '#1e293b',
          fontWeight: 700
        }}>
          {unreadCount}
        </span>
        <button
          type="button"
          onClick={incUnread}
          style={{
            marginLeft: 'auto',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #4338ca',
            background: '#4338ca',
            color: '#f8fafc',
            fontWeight: 600
          }}
        >
          Simulate New Message
        </button>
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Your Courses</h2>
        {loadingCourses ? (
          <p style={{ margin: 0, color: '#64748b' }}>Loading courses...</p>
        ) : courses.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => handleCourseClick(course.id)}
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
                <span style={{ fontWeight: 600, fontSize: 16 }}>{course.name}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {course.course_code ?? 'Course overview'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>No courses available yet.</p>
        )}
      </section>
    </div>
  );
}
