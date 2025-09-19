import React, { useEffect, useMemo, useState } from 'react';
import CoursesGrid from '../components/CoursesGrid';
import AssignmentsList from '../components/AssignmentsList';
import CalendarEvents, { type CalendarItem } from '../components/CalendarEvents';
import AssignmentDetail from './AssignmentDetail';
import ChatbotPanel from '../components/ChatbotPanel';
import { deriveCourseGrade } from '../../lib/gradeUtils';
import { DEFAULT_GRADE_SCALE, parseSyllabusScale } from '../../lib/syllabusParser';
import { rendererError, rendererLog } from '../../lib/logger';
import { getPlatformBridge } from '../../lib/platformBridge';
import { getAssignments, getCalendarEvents, getCourses } from '../../lib/canvasClient';
import type { Assignment, CalendarEvent, Course } from '../../lib/canvasClient';
import { useStore } from '../state/store';

// PHASE 6: Bridge all platform-specific APIs through a shared adapter.
const dued8 = getPlatformBridge();

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
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

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
          // PHASE 1: Normalize Canvas events to prepare for merged calendar rendering.
          const sanitized = response.data.filter((event): event is CalendarEvent => Boolean(event?.start_at));
          setEvents(sanitized);
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

  const calendarItems = useMemo<CalendarItem[]>(() => {
    // PHASE 1: Merge Canvas events with assignment deadlines for a complete calendar view.
    const merged: CalendarItem[] = [];
    events.forEach((event) => {
      if (!event.start_at) return;
      merged.push({
        id: `event-${event.id}`,
        title: event.title,
        start_at: event.start_at,
        context_name: event.context_name,
        html_url: event.html_url,
        source: 'event'
      });
    });
    assignments.forEach((assignment) => {
      if (!assignment.due_at) return;
      merged.push({
        id: `assignment-${assignment.id}`,
        title: assignment.name,
        start_at: assignment.due_at,
        context_name: courseLookup[assignment.course_id] ?? 'Canvas assignment',
        html_url: assignment.html_url,
        source: 'assignment'
      });
    });
    return merged.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [events, assignments, courseLookup]);

  const isDashboardView = view.screen === 'dashboard';
  const selectedCourse = useMemo(() => {
    if (view.screen === 'course' || view.screen === 'assignment') {
      return courses.find((course) => course.id === view.courseId) ?? null;
    }
    return null;
  }, [courses, view]);

  const selectedAssignment = useMemo(() => {
    if (view.screen === 'assignment') {
      return assignments.find((assignment) => assignment.id === view.assignmentId) ?? null;
    }
    return null;
  }, [assignments, view]);

  const assignmentCourseName = view.screen === 'assignment' ? courseLookup[view.courseId] : undefined;

  const courseAssignments = useMemo(() => {
    if (view.screen === 'course') {
      return assignments.filter((assignment) => assignment.course_id === view.courseId);
    }
    return [];
  }, [assignments, view]);

  const isCourseView = view.screen === 'course';
  const isAssignmentView = view.screen === 'assignment';

  const courseGrade = selectedCourse ? deriveCourseGrade(selectedCourse) : null;
  const parsedScale = useMemo(() => {
    if (!selectedCourse) return [];
    return parseSyllabusScale(selectedCourse.syllabus_body);
  }, [selectedCourse]);
  const gradeScale = parsedScale.length ? parsedScale : DEFAULT_GRADE_SCALE;
  const usingDefaultScale = !parsedScale.length;

  const courseHeaderLabel = view.screen === 'course'
    ? selectedCourse?.name ?? courseLookup[view.courseId] ?? 'Course overview'
    : undefined;

  const courseSubtitleLabel = view.screen === 'course'
    ? courseLookup[view.courseId] ?? selectedCourse?.name ?? 'Course overview'
    : undefined;

  const headerTitle = isDashboardView
    ? 'DueD8 Dashboard'
    : isCourseView
      ? courseHeaderLabel ?? 'Course overview'
      : selectedAssignment?.name ?? 'Assignment details';

  const headerSubtitle = isDashboardView
    ? `Welcome back${profile?.name ? `, ${profile.name}` : ''}.`
    : isCourseView
      ? courseSubtitleLabel ?? 'Course overview'
      : assignmentCourseName
        ? `${assignmentCourseName} assignment`
        : 'Assignment focus';

  const assignmentBackLabel = assignmentCourseName ? `Back to ${assignmentCourseName}` : 'Back to dashboard';

  const handleBackFromAssignment = () => {
    if (view.screen !== 'assignment') return;
    if (courses.some((course) => course.id === view.courseId)) {
      setView({ screen: 'course', courseId: view.courseId });
    } else {
      setView({ screen: 'dashboard' });
    }
  };

  return (
    <>
      <div
        style={{
          padding: 32,
          minHeight: '100vh',
          background: 'var(--surface-background)',
          display: 'flex',
          flexDirection: 'column',
          gap: 32
        }}
      >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isDashboardView ? (
            <button
              type="button"
              onClick={() =>
                isAssignmentView ? handleBackFromAssignment() : setView({ screen: 'dashboard' })
              }
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: '1px solid var(--surface-border)',
                borderRadius: 999,
                padding: '6px 16px',
                cursor: 'pointer'
              }}
            >
              ← {isAssignmentView ? assignmentBackLabel : 'Back to dashboard'}
            </button>
          ) : null}
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{headerTitle}</h1>
          {isCourseView && courseGrade ? (
            <span
              style={{
                alignSelf: 'flex-start',
                marginTop: -4,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--surface-border)',
                background: courseGrade.status === 'complete' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                color: courseGrade.status === 'complete' ? '#047857' : 'var(--text-secondary)',
                fontSize: 12
              }}
            >
              {/* PHASE 4: Surface course grade beside the detail title. */}
              {courseGrade.display}
            </span>
          ) : null}
          <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{headerSubtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#047857',
              fontWeight: 600,
              border: '1px solid rgba(16,185,129,0.2)'
            }}
          >
            Canvas status: Connected
          </span>
          <button
            type="button"
            onClick={handleDisconnect}
            style={{
              /* PHASE 1: Align button treatment with softer Apple palette. */
              background: '#1f1f1f',
              color: '#fff',
              border: 'none',
              padding: '12px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              boxShadow: '0 10px 18px rgba(0,0,0,0.15)'
            }}
          >
            Disconnect
          </button>
        </div>
      </header>

      {isDashboardView ? (
        <>
          <section
            style={{
              background: 'var(--surface-card)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
              border: '1px solid var(--surface-border)'
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 24, fontWeight: 600 }}>Profile</h2>
            <div style={{ color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600 }}>{profile?.name ?? 'Unknown user'}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{profile?.primary_email ?? 'No primary email on file'}</span>
            </div>
          </section>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <section
              style={{
                background: 'var(--surface-card)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
                border: '1px solid var(--surface-border)'
              }}
            >
              <h2 style={{ marginTop: 0 }}>Active Courses</h2>
              <CoursesGrid
                courses={courses}
                loading={loadingCourses}
                onSelectCourse={(course) => setView({ screen: 'course', courseId: course.id })}
              />
            </section>
            <section
              style={{
                background: 'var(--surface-card)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
                border: '1px solid var(--surface-border)'
              }}
            >
              <h2 style={{ marginTop: 0 }}>Upcoming Assignments</h2>
              <AssignmentsList
                assignments={assignments}
                courseLookup={courseLookup}
                loading={loadingAssignments}
                onSelect={(assignment) =>
                  setView({ screen: 'assignment', courseId: assignment.course_id, assignmentId: assignment.id })
                }
              />
            </section>
            <section
              style={{
                background: 'var(--surface-card)',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
                border: '1px solid var(--surface-border)'
              }}
            >
              <h2 style={{ marginTop: 0 }}>Calendar (Next 14 days)</h2>
              <CalendarEvents events={calendarItems} loading={loadingEvents && loadingAssignments} />
            </section>
          </div>
        </>
      ) : null}

      {isCourseView ? (
        <section
          style={{
            background: 'var(--surface-card)',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
            border: '1px solid var(--surface-border)'
          }}
        >
          {/* PHASE 2: Dedicated course screen primes future context-aware prompts. */}
          <h2 style={{ marginTop: 0 }}>Course overview</h2>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {selectedCourse?.course_code ? `${selectedCourse.course_code} · ` : ''}
            {selectedCourse?.name ?? 'Course details'}
          </div>
          <div style={{ display: 'grid', gap: 16, marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div
              style={{
                border: '1px solid var(--surface-border)',
                borderRadius: 16,
                padding: 16,
                background: 'rgba(255,255,255,0.8)'
              }}
            >
              <strong>Current grade</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                {courseGrade?.display ?? 'In Progress'}
              </div>
            </div>
            <div
              style={{
                border: '1px solid var(--surface-border)',
                borderRadius: 16,
                padding: 16,
                background: 'rgba(255,255,255,0.8)'
              }}
            >
              <strong>Grading scale</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {usingDefaultScale ? 'Default DueD8 scale applied' : 'Parsed from syllabus'}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {gradeScale.map((band) => (
                  <li key={band.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{band.label}</span>
                    <span>{band.min}–{band.max}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <AssignmentsList
            assignments={courseAssignments}
            courseLookup={courseLookup}
            loading={loadingAssignments}
            onSelect={(assignment) =>
              setView({ screen: 'assignment', courseId: assignment.course_id, assignmentId: assignment.id })
            }
          />
        </section>
      ) : null}

        {isAssignmentView ? (
          <AssignmentDetail
            assignment={selectedAssignment}
            courseName={assignmentCourseName}
            courseCode={selectedCourse?.course_code}
            onBack={handleBackFromAssignment}
            backLabel={assignmentBackLabel}
          />
        ) : null}
      </div>

      {/* PHASE 3: Persist the chatbot across all dashboard sub-views. */}
      <ChatbotPanel
        view={view}
        profileName={profile?.name}
        selectedCourse={selectedCourse}
        selectedAssignment={selectedAssignment}
        courseAssignments={courseAssignments}
        upcomingAssignments={assignments}
        assignmentCourseName={assignmentCourseName}
        courseLookup={courseLookup}
      />
    </>
  );
}