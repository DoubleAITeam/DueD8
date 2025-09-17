import React, { useEffect, useMemo, useState } from 'react';
import CoursesGrid from '../components/CoursesGrid';
import AssignmentsList from '../components/AssignmentsList';
import CalendarEvents from '../components/CalendarEvents';
import { rendererError, rendererLog } from '../../lib/logger';
import { getAssignments, getCalendarEvents, getCourses } from '../../lib/canvasClient';
import type { Assignment, CalendarEvent, Course } from '../../lib/canvasClient';
import { useStore } from '../state/store';

const dued8 = window.dued8;

function inNextDays(dateString: string | null, days: number) {
  if (!dateString) return false;
  const due = new Date(dateString);
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + days);
  return due >= now && due <= horizon;
}

export default function Dashboard() {
  const profile = useStore((s) => s.profile);
  const setConnected = useStore((s) => s.setConnected);
  const setProfile = useStore((s) => s.setProfile);
  const setToast = useStore((s) => s.setToast);

  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const courseLookup = useMemo(() => {
    return courses.reduce<Record<number, string>>((acc, course) => {
      acc[course.id] = course.course_code || course.name;
      return acc;
    }, {});
  }, [courses]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoadingCourses(true);
      const result = await getCourses();
      if (cancelled) return;
      if (result.ok && Array.isArray(result.data)) {
        rendererLog('Loaded courses', result.data.length);
        setCourses(result.data);
      } else {
        rendererError('Failed to load courses', result.error);
        setCourses([]);
        setToast('Unable to load Canvas courses.');
      }
      setLoadingCourses(false);
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [setToast]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      setLoadingAssignments(true);
      if (!courses.length) {
        setAssignments([]);
        setLoadingAssignments(false);
        return;
      }

      try {
        const responses = await Promise.all(courses.map((course) => getAssignments(course.id)));
        if (cancelled) return;
        const allAssignments: Assignment[] = [];
        responses.forEach((res, index) => {
          if (res.ok && Array.isArray(res.data)) {
            const filtered = res.data.filter((assignment) => inNextDays(assignment.due_at, 14));
            allAssignments.push(...filtered.map((a) => ({ ...a, course_id: courses[index].id })));
          } else {
            rendererError('Assignments request failed', res.error);
          }
        });
        allAssignments.sort((a, b) => {
          const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
          const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
          return da - db;
        });
        setAssignments(allAssignments);
      } catch (error) {
        rendererError('Unexpected assignments error', error);
        setAssignments([]);
        if (!cancelled) {
          setToast('Unable to load Canvas assignments.');
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [courses, setToast]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoadingEvents(true);
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 14);
      try {
        const response = await getCalendarEvents(start.toISOString(), end.toISOString());
        if (cancelled) return;
        if (response.ok && Array.isArray(response.data)) {
          rendererLog('Loaded calendar events', response.data.length);
          setEvents(response.data);
        } else {
          rendererError('Calendar events failed', response.error);
          setEvents([]);
          setToast('Unable to load Canvas calendar.');
        }
      } catch (error) {
        rendererError('Unexpected calendar error', error);
        if (!cancelled) {
          setToast('Unable to load Canvas calendar.');
        }
        setEvents([]);
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [setToast]);

  async function handleDisconnect() {
    const result = await dued8.canvas.clearToken();
    if (!result.ok) {
      setToast('Failed to clear Canvas token.');
      return;
    }
    setConnected(false);
    setProfile(null);
    setCourses([]);
    setAssignments([]);
    setEvents([]);
    setToast('Disconnected from Canvas.');
  }

  return (
    <div style={{ padding: 32, minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>DueD8 Dashboard</h1>
          <div style={{ color: '#475569' }}>
            Welcome back{profile?.name ? `, ${profile.name}` : ''}.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: '#bbf7d0',
              color: '#14532d',
              fontWeight: 600
            }}
          >
            Canvas status: Connected
          </span>
          <button
            type="button"
            onClick={handleDisconnect}
            style={{
              background: '#1e293b',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 12,
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      </header>

      <section
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)'
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 24, fontWeight: 600 }}>Profile</h2>
        <div style={{ color: '#1e293b', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{profile?.name ?? 'Unknown user'}</span>
          <span style={{ color: '#475569' }}>{profile?.primary_email ?? 'No primary email on file'}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Active Courses</h2>
          <CoursesGrid courses={courses} loading={loadingCourses} />
        </section>
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Upcoming Assignments</h2>
          <AssignmentsList assignments={assignments} courseLookup={courseLookup} loading={loadingAssignments} />
        </section>
        <section style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Calendar (Next 14 days)</h2>
          <CalendarEvents events={events} loading={loadingEvents} />
        </section>
      </div>
    </div>
  );
}