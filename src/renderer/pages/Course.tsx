import React, { useEffect, useMemo, useState } from 'react';
import { rendererError, rendererLog } from '../../lib/logger';
import { getAssignments } from '../../lib/canvasClient';
import type { Assignment } from '../../lib/canvasClient';
import { useStore } from '../state/store';
import AssignmentsList from '../components/AssignmentsList';

export default function Course() {
  const view = useStore((s) => s.view);
  const setToast = useStore((s) => s.setToast);
  const navigateToDashboard = useStore((s) => s.navigateToDashboard);
  const navigateToAssignment = useStore((s) => s.navigateToAssignment);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view.name !== 'course') return;
    let cancelled = false;

    async function loadAssignments() {
      setLoading(true);
      try {
        const result = await getAssignments(view.course.id);
        if (cancelled) return;
        if (result.ok && Array.isArray(result.data)) {
          rendererLog('Course assignments loaded', result.data.length);
          setAssignments(result.data);
        } else {
          rendererError('Failed to load course assignments', result.error);
          setAssignments([]);
          setToast('Unable to load assignments for this course.');
        }
      } catch (error) {
        rendererError('Unexpected course assignment error', error);
        if (!cancelled) {
          setAssignments([]);
          setToast('Unable to load assignments for this course.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [setToast, view]);

  const course = view.name === 'course' ? view.course : null;

  const courseLookup = useMemo(() => {
    if (!course) return {};
    return { [course.id]: course.course_code || course.name };
  }, [course]);

  if (!course) {
    return (
      <div style={{ padding: 32 }}>
        <button
          type="button"
          onClick={navigateToDashboard}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#2563eb',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        <p style={{ marginTop: 24 }}>Select a course from the dashboard to view its assignments.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={navigateToDashboard}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#2563eb',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{course.name}</h1>
          <div style={{ color: '#475569' }}>{course.course_code ?? 'Course details unavailable'}</div>
        </div>
      </header>

      <section
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 12px 32px rgba(15,23,42,0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Assignments</h2>
          <span style={{ color: '#64748b', fontSize: 14 }}>
            {loading ? 'Loading…' : `${assignments.length} item${assignments.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <AssignmentsList
          assignments={assignments}
          courseLookup={courseLookup}
          loading={loading}
          onSelect={(assignment) => navigateToAssignment(course, assignment)}
        />
      </section>
    </div>
  );
}
