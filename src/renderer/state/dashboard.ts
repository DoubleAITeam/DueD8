import React from 'react';
import { create } from 'zustand';
import { rendererError, rendererLog } from '../../lib/logger';
import {
  getAssignments,
  getCalendarEvents,
  getCourses,
  getPastAssignments
} from '../../lib/canvasClient';
import type { Assignment, CalendarEvent, Course } from '../../lib/canvasClient';
import { featureFlags as sharedFeatureFlags } from '../../shared/featureFlags';
import { useStore } from './store';
import { getCourseColor } from '../utils/colors';

export type StudyTool = {
  id: string;
  title: string;
  launchedAtIso: string;
};

export type CourseProgress = {
  id: string;
  name: string;
  completedAssignments: number;
  totalAssignments: number;
  color: 'blue' | 'green' | 'purple';
};

export type Deadline = {
  id: string;
  title: string;
  course: string;
  dueAtIso: string;
  action?: { label: string; intent: 'submit' | 'view' | 'study' };
  metadata?: {
    courseId?: number;
    assignmentId?: number;
    htmlUrl?: string;
  };
};

export type DashboardCalendarItem = {
  id: string;
  title: string;
  start_at: string;
  context_name?: string;
  html_url?: string;
  source: 'event' | 'assignment';
  courseId?: number;
};

type DashboardStatus = 'idle' | 'loading' | 'ready' | 'error';

type DashboardState = {
  aiTokens: { used: number; limit: number };
  courses: CourseProgress[];
  deadlines: Deadline[];
  recentlyLaunched: StudyTool[];
  rawCourses: Course[];
  upcomingAssignments: Assignment[];
  pastAssignments: Assignment[];
  calendarItems: DashboardCalendarItem[];
  featureFlags: { newDashboard: boolean };
  status: DashboardStatus;
  error: string | null;
  ensureData: (options?: { force?: boolean }) => Promise<void>;
  setFeatureFlag: (flag: keyof DashboardState['featureFlags'], value: boolean) => void;
  courseColors: Record<number, string>;
  setCourseColor: (courseId: number, color: string) => void;
};

const progressColorCycle: CourseProgress['color'][] = ['blue', 'green', 'purple'];

function inNextDays(dateString: string | null | undefined, days: number) {
  if (!dateString) return false;
  const due = new Date(dateString);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + days);
  return due >= now && due <= horizon;
}

function normaliseCourseName(course: Course) {
  return course.course_code || course.name;
}

function toDeadline(params: {
  id: string;
  title: string;
  courseName: string;
  dueAtIso: string;
  metadata?: Deadline['metadata'];
  intent?: Deadline['action']['intent'];
}): Deadline {
  return {
    id: params.id,
    title: params.title,
    course: params.courseName,
    dueAtIso: params.dueAtIso,
    action: { label: 'View', intent: params.intent ?? 'view' },
    metadata: params.metadata
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  aiTokens: { used: 2200, limit: 7500 },
  courses: [],
  deadlines: [],
  recentlyLaunched: [],
  rawCourses: [],
  upcomingAssignments: [],
  pastAssignments: [],
  calendarItems: [],
  featureFlags: { newDashboard: sharedFeatureFlags.newDashboard },
  status: 'idle',
  error: null,
  courseColors: {},
  setFeatureFlag: (flag, value) =>
    set((state) => ({
      featureFlags: {
        ...state.featureFlags,
        [flag]: value
      }
    })),
  setCourseColor: (courseId, color) =>
    set((state) => ({
      courseColors: {
        ...state.courseColors,
        [courseId]: color
      }
    })),
  ensureData: async ({ force = false } = {}) => {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) {
      return;
    }
    set({ status: 'loading', error: null });

    try {
      const coursesResult = await getCourses();
      if (!coursesResult.ok || !Array.isArray(coursesResult.data)) {
        const message = coursesResult.error ?? 'Unable to load Canvas courses.';
        throw new Error(message);
      }

      const courses = coursesResult.data;
      rendererLog('Dashboard data: loaded courses', courses.length);

      const courseNameLookup = new Map<number, string>();
      courses.forEach((course) => {
        courseNameLookup.set(course.id, normaliseCourseName(course));
      });

      const courseColorsState = { ...get().courseColors };
      courses.forEach((course, index) => {
        if (!courseColorsState[course.id]) {
          courseColorsState[course.id] = getCourseColor(course.id, index);
        }
      });

      const assignmentResponses = await Promise.all(
        courses.map((course) =>
          Promise.all([getAssignments(course.id), getPastAssignments(course.id)])
        )
      );

      const now = Date.now();
      const courseProgressRows: CourseProgress[] = [];
      const deadlineCollection: Deadline[] = [];
      const recentAssignments: Assignment[] = [];
      const upcomingAssignments: Assignment[] = [];
      const pastAssignments: Assignment[] = [];

      courses.forEach((course, index) => {
        const [upcomingRes, pastRes] = assignmentResponses[index];
        const assignmentMap = new Map<number, { assignment: Assignment; isPast: boolean }>();

        if (upcomingRes.ok && Array.isArray(upcomingRes.data)) {
          upcomingRes.data.forEach((assignment) => {
            const withCourse: Assignment = { ...assignment, course_id: course.id };
            assignmentMap.set(withCourse.id, {
              assignment: withCourse,
              isPast: false
            });
            upcomingAssignments.push(withCourse);

            if (withCourse.due_at && inNextDays(withCourse.due_at, 14)) {
              deadlineCollection.push(
                toDeadline({
                  id: `assignment-${withCourse.id}`,
                  title: withCourse.name,
                  courseName: courseNameLookup.get(course.id) ?? course.name,
                  dueAtIso: withCourse.due_at,
                  metadata: {
                    courseId: course.id,
                    assignmentId: withCourse.id,
                    htmlUrl: withCourse.html_url
                  }
                })
              );
            }
          });
        } else if (!upcomingRes.ok) {
          rendererError('Upcoming assignments request failed', upcomingRes.error);
        }

        if (pastRes.ok && Array.isArray(pastRes.data)) {
          pastRes.data.forEach((assignment) => {
            const withCourse: Assignment = { ...assignment, course_id: course.id };
            assignmentMap.set(withCourse.id, { assignment: withCourse, isPast: true });
            pastAssignments.push(withCourse);
            if (withCourse.due_at) {
              recentAssignments.push(withCourse);
            }
          });
        } else if (!pastRes.ok) {
          rendererError('Past assignments request failed', pastRes.error);
        }

        const assignmentsForCourse = Array.from(assignmentMap.values());
        const totalAssignments = assignmentsForCourse.length;
        const completedAssignments = assignmentsForCourse.filter((entry) => {
          if (entry.isPast) return true;
          if (!entry.assignment.due_at) return false;
          return new Date(entry.assignment.due_at).getTime() < now;
        }).length;

        courseProgressRows.push({
          id: String(course.id),
          name: courseNameLookup.get(course.id) ?? course.name,
          completedAssignments,
          totalAssignments,
          color: progressColorCycle[index % progressColorCycle.length]
        });
      });

      const calendarItems: DashboardCalendarItem[] = [];

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      try {
        const eventsResult = await getCalendarEvents(start.toISOString(), end.toISOString());
        if (eventsResult.ok && Array.isArray(eventsResult.data)) {
          eventsResult.data.forEach((event: CalendarEvent) => {
            if (!event.start_at) return;
            if (!inNextDays(event.start_at, 30)) return;
            let inferredCourseId: number | undefined;
            if (event.context_name) {
              for (const [id, name] of courseNameLookup.entries()) {
                if (event.context_name === name || event.context_name.includes(name)) {
                  inferredCourseId = id;
                  break;
                }
              }
            }

            calendarItems.push({
              id: `event-${event.id}`,
              title: event.title,
              start_at: event.start_at,
              context_name: event.context_name,
              html_url: event.html_url,
              source: 'event',
              courseId: inferredCourseId
            });
          });
        } else if (!eventsResult.ok) {
          rendererError('Calendar events request failed', eventsResult.error);
        }
      } catch (error) {
        rendererError('Unexpected error loading calendar events', error);
      }

      upcomingAssignments.forEach((assignment) => {
        if (!assignment.due_at) return;
        if (!inNextDays(assignment.due_at, 30)) return;
        calendarItems.push({
          id: `assignment-${assignment.id}`,
          title: assignment.name,
          start_at: assignment.due_at,
          context_name: courseNameLookup.get(assignment.course_id) ?? 'Assignment',
          html_url: assignment.html_url,
          source: 'assignment',
          courseId: assignment.course_id
        });
      });

      deadlineCollection.sort(
        (a, b) => new Date(a.dueAtIso).getTime() - new Date(b.dueAtIso).getTime()
      );

      recentAssignments.sort((a, b) => {
        const aTime = a.due_at ? new Date(a.due_at).getTime() : 0;
        const bTime = b.due_at ? new Date(b.due_at).getTime() : 0;
        return bTime - aTime;
      });

      const recentItems: StudyTool[] = recentAssignments.slice(0, 6).map((assignment) => ({
        id: `recent-${assignment.id}`,
        title: assignment.name,
        launchedAtIso: assignment.due_at ?? new Date().toISOString()
      }));

      set({
        rawCourses: courses,
        courses: courseProgressRows,
        deadlines: deadlineCollection,
        recentlyLaunched: recentItems,
        upcomingAssignments,
        pastAssignments,
        calendarItems,
        courseColors: courseColorsState,
        status: 'ready',
        error: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown dashboard error.';
      rendererError('Failed to load dashboard data', error);
      set({ status: 'error', error: message });
    }
  }
}));

export function useDashboardData(options?: { force?: boolean }) {
  const ensureData = useDashboardStore((state) => state.ensureData);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);

  React.useEffect(() => {
    void ensureData({ force: options?.force ?? false });
  }, [ensureData, options?.force]);

  return { status, error };
}

export function useUser() {
  return useStore((state) => ({
    name: state.profile?.name ?? 'there'
  }));
}

export function useAiTokenStore() {
  return useDashboardStore((state) => state.aiTokens);
}

export function useCourses() {
  return useDashboardStore((state) => state.courses);
}

export function useDeadlines() {
  return useDashboardStore((state) => state.deadlines);
}

export function useRecentlyLaunched() {
  return useDashboardStore((state) => state.recentlyLaunched);
}

export function useFeatureFlags() {
  return useDashboardStore((state) => ({
    featureFlags: state.featureFlags,
    setFeatureFlag: state.setFeatureFlag
  }));
}

export function useRawCourses() {
  return useDashboardStore((state) => state.rawCourses);
}

export function useUpcomingAssignments() {
  return useDashboardStore((state) => state.upcomingAssignments);
}

export function usePastAssignments() {
  return useDashboardStore((state) => state.pastAssignments);
}

export function useCalendarItems() {
  return useDashboardStore((state) => state.calendarItems);
}

export function useDashboardStatus() {
  return useDashboardStore((state) => state.status);
}

export function useCourseColors() {
  return useDashboardStore((state) => state.courseColors);
}

export function useSetCourseColor() {
  return useDashboardStore((state) => state.setCourseColor);
}

export function useAssignmentById(assignmentId: number | null) {
  return useDashboardStore((state) => {
    if (!assignmentId) return null;
    return (
      state.upcomingAssignments.find((assignment) => assignment.id === assignmentId) ??
      state.pastAssignments.find((assignment) => assignment.id === assignmentId) ??
      null
    );
  });
}

export function useCourseById(courseId: number | null) {
  return useDashboardStore((state) => {
    if (!courseId) return null;
    return state.rawCourses.find((course) => course.id === courseId) ?? null;
  });
}
