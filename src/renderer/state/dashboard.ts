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
import { useAiUsageStore } from './aiUsage';
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
  source: 'event' | 'assignment' | 'custom';
  courseId?: number;
  customCalendarId?: string;
  location?: string;
  link?: string;
};

export type CustomCalendar = {
  id: string;
  name: string;
  color: string;
};

export type CustomEvent = {
  id: string;
  title: string;
  start_at: string;
  courseId?: number;
  customCalendarId?: string;
  location?: string;
  link?: string;
};

type DashboardStatus = 'idle' | 'loading' | 'ready' | 'error';

type DashboardState = {
  courses: CourseProgress[];
  deadlines: Deadline[];
  recentlyLaunched: StudyTool[];
  rawCourses: Course[];
  upcomingAssignments: Assignment[];
  pastAssignments: Assignment[];
  calendarItems: DashboardCalendarItem[];
  customEvents: CustomEvent[];
  customCalendars: CustomCalendar[];
  featureFlags: { newDashboard: boolean };
  status: DashboardStatus;
  error: string | null;
  ensureData: (options?: { force?: boolean }) => Promise<void>;
  setFeatureFlag: (flag: keyof DashboardState['featureFlags'], value: boolean) => void;
  courseColors: Record<number, string>;
  setCourseColor: (courseId: number, color: string) => void;
  addCustomEvent: (event: Omit<CustomEvent, 'id'>) => void;
  updateCustomEvent: (id: string, updates: Partial<Omit<CustomEvent, 'id'>>) => void;
  deleteCustomEvent: (id: string) => void;
  addCustomCalendar: (calendar: Omit<CustomCalendar, 'id'>) => CustomCalendar;
  updateCustomCalendar: (id: string, updates: Partial<Omit<CustomCalendar, 'id'>>) => void;
  deleteCustomCalendar: (id: string) => void;
};

const progressColorCycle: CourseProgress['color'][] = ['blue', 'green', 'purple'];

// Local storage utilities for custom events
const CUSTOM_EVENTS_KEY = 'dued8-custom-events';
const CUSTOM_CALENDARS_KEY = 'dued8-custom-calendars';

const DEFAULT_CUSTOM_CALENDARS: CustomCalendar[] = [
  { id: 'default-general', name: 'General', color: '#64748b' },
  { id: 'default-personal', name: 'Personal', color: '#059669' },
  { id: 'default-study', name: 'Study', color: '#7c3aed' },
  { id: 'default-reminder', name: 'Reminder', color: '#dc2626' }
];

function normaliseStoredCalendars(calendars: unknown): CustomCalendar[] {
  if (!Array.isArray(calendars)) return [];
  return calendars
    .map((value) => {
      if (
        value &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        typeof value.color === 'string'
      ) {
        return { id: value.id, name: value.name, color: value.color } satisfies CustomCalendar;
      }
      return null;
    })
    .filter((value): value is CustomCalendar => value != null);
}

function mergeDefaultCalendars(calendars: CustomCalendar[]): CustomCalendar[] {
  const existingIds = new Set(calendars.map((calendar) => calendar.id));
  const merged = [...calendars];
  DEFAULT_CUSTOM_CALENDARS.forEach((calendar) => {
    if (!existingIds.has(calendar.id)) {
      merged.push(calendar);
    }
  });
  return merged;
}

function loadCustomCalendars(): CustomCalendar[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CALENDARS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const normalised = mergeDefaultCalendars(normaliseStoredCalendars(parsed));
    if (stored == null || normalised.length !== normaliseStoredCalendars(parsed).length) {
      saveCustomCalendars(normalised);
    }
    return normalised;
  } catch {
    return [...DEFAULT_CUSTOM_CALENDARS];
  }
}

function saveCustomCalendars(calendars: CustomCalendar[]): void {
  try {
    localStorage.setItem(CUSTOM_CALENDARS_KEY, JSON.stringify(calendars));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function loadCustomEvents(): CustomEvent[] {
  try {
    const stored = localStorage.getItem(CUSTOM_EVENTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const events: CustomEvent[] = [];

    parsed.forEach((value) => {
      if (!value || typeof value !== 'object') return;

      if ('category' in value && typeof value.category === 'string') {
        const calendarId = `default-${value.category}`;
        const legacyEvent: CustomEvent = {
          id: typeof value.id === 'string' ? value.id : generateEventId(),
          title: typeof value.title === 'string' ? value.title : 'Untitled event',
          start_at: typeof value.start_at === 'string' ? value.start_at : new Date().toISOString(),
          customCalendarId: calendarId,
          location: typeof value.location === 'string' ? value.location : undefined,
          link: typeof value.link === 'string' ? value.link : undefined
        };
        events.push(legacyEvent);
        return;
      }

      const id = typeof value.id === 'string' ? value.id : generateEventId();
      const title = typeof value.title === 'string' ? value.title : 'Untitled event';
      const startAt =
        typeof value.start_at === 'string' ? value.start_at : new Date().toISOString();
      const courseId =
        typeof value.courseId === 'number' && Number.isFinite(value.courseId)
          ? value.courseId
          : undefined;
      const customCalendarId =
        typeof value.customCalendarId === 'string' ? value.customCalendarId : undefined;
      const location = typeof value.location === 'string' ? value.location : undefined;
      const link = typeof value.link === 'string' ? value.link : undefined;

      const event: CustomEvent = { id, title, start_at: startAt, courseId, customCalendarId, location, link };
      events.push(event);
    });

    return events;
  } catch {
    return [];
  }
}

function saveCustomEvents(events: CustomEvent[]): void {
  try {
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function generateEventId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateCalendarId(): string {
  return `calendar-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

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
  intent?: 'submit' | 'view' | 'study';
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
  customEvents: loadCustomEvents(),
  customCalendars: loadCustomCalendars(),
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
  addCustomEvent: (eventData) => {
    const newEvent: CustomEvent = {
      id: generateEventId(),
      ...eventData
    };

    if (newEvent.courseId == null && !newEvent.customCalendarId) {
      newEvent.customCalendarId = 'default-general';
    }

    set((state) => {
      const newCustomEvents = [...state.customEvents, newEvent];
      saveCustomEvents(newCustomEvents);
      return { customEvents: newCustomEvents };
    });
  },
  updateCustomEvent: (id, updates) => {
    set((state) => {
      const newCustomEvents = state.customEvents.map((event) =>
        event.id === id ? { ...event, ...updates } : event
      );
      saveCustomEvents(newCustomEvents);
      return { customEvents: newCustomEvents };
    });
  },
  deleteCustomEvent: (id) => {
    set((state) => {
      const newCustomEvents = state.customEvents.filter((event) => event.id !== id);
      saveCustomEvents(newCustomEvents);
      return { customEvents: newCustomEvents };
    });
  },
  addCustomCalendar: (calendarData) => {
    const newCalendar: CustomCalendar = {
      id: generateCalendarId(),
      ...calendarData
    };

    set((state) => {
      const customCalendars = mergeDefaultCalendars([...state.customCalendars, newCalendar]);
      saveCustomCalendars(customCalendars);
      return { customCalendars };
    });

    return newCalendar;
  },
  updateCustomCalendar: (id, updates) => {
    set((state) => {
      const customCalendars = state.customCalendars.map((calendar) =>
        calendar.id === id ? { ...calendar, ...updates } : calendar
      );
      saveCustomCalendars(customCalendars);
      return { customCalendars };
    });
  },
  deleteCustomCalendar: (id) => {
    set((state) => {
      // Don't allow deleting default calendars
      if (id.startsWith('default-')) return state;
      
      // Remove the calendar
      const customCalendars = state.customCalendars.filter((calendar) => calendar.id !== id);
      saveCustomCalendars(customCalendars);
      
      // Remove all events associated with this calendar
      const customEvents = state.customEvents.filter((event) => event.customCalendarId !== id);
      saveCustomEvents(customEvents);
      
      return { customCalendars, customEvents };
    });
  },
  ensureData: async ({ force = false } = {}) => {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) {
      return;
    }
    set({ status: 'loading', error: null });

    try {
      const coursesResult = await getCourses();
      if (!coursesResult.ok || !Array.isArray(coursesResult.data)) {
        const message = coursesResult.ok ? 'Unable to load Canvas courses.' : coursesResult.error;
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

      // Add custom events to calendar items
      const { customEvents, customCalendars } = get();
      const customCalendarLookup = new Map(
        customCalendars.map((calendar) => [calendar.id, calendar.name])
      );

      customEvents.forEach((customEvent) => {
        if (!inNextDays(customEvent.start_at, 30)) return;
        calendarItems.push({
          id: customEvent.id,
          title: customEvent.title,
          start_at: customEvent.start_at,
          context_name: customEvent.customCalendarId
            ? customCalendarLookup.get(customEvent.customCalendarId)
            : undefined,
          source: 'custom',
          courseId: customEvent.courseId,
          customCalendarId: customEvent.customCalendarId,
          location: customEvent.location,
          link: customEvent.link
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
    name: state.profile?.name ?? 'there',
    avatarUrl: state.profile?.avatarUrl ?? null
  }));
}

export function useAiTokenStore() {
  const plan = useStore((state) => {
    if (state.profile?.plan) {
      return state.profile.plan;
    }
    if (state.profile?.isPremium) {
      return 'premium';
    }
    return 'free';
  });

  return useAiUsageStore((state) => {
    const limit = plan === 'premium' ? state.limits.premium : state.limits.free;
    const used = state.usageToday;
    const warningThreshold = state.warningThreshold;
    const nearingLimit = plan === 'free' && used >= warningThreshold * limit;
    const overLimit = plan === 'free' && used >= limit;
    return {
      used,
      limit,
      warningThreshold,
      nearingLimit,
      overLimit,
      tasks: state.tasks
    };
  });
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
  const calendarItems = useDashboardStore((state) => state.calendarItems);
  const customEvents = useDashboardStore((state) => state.customEvents);
  const customCalendars = useDashboardStore((state) => state.customCalendars);

  return React.useMemo(() => {
    const calendarLookup = new Map(customCalendars.map((calendar) => [calendar.id, calendar]));
    const merged = new Map<string, DashboardCalendarItem>();

    calendarItems.forEach((item) => {
      merged.set(item.id, { ...item });
    });

    customEvents.forEach((event) => {
      const calendar = event.customCalendarId ? calendarLookup.get(event.customCalendarId) : undefined;
      merged.set(event.id, {
        id: event.id,
        title: event.title,
        start_at: event.start_at,
        context_name: calendar?.name,
        source: 'custom',
        courseId: event.courseId,
        customCalendarId: event.customCalendarId,
        location: event.location,
        link: event.link
      });
    });

    return Array.from(merged.values());
  }, [calendarItems, customEvents, customCalendars]);
}

export function useCustomEvents() {
  return useDashboardStore((state) => state.customEvents);
}

export function useCustomEventActions() {
  return useDashboardStore((state) => ({
    addCustomEvent: state.addCustomEvent,
    updateCustomEvent: state.updateCustomEvent,
    deleteCustomEvent: state.deleteCustomEvent
  }));
}

export function useCustomCalendars() {
  return useDashboardStore((state) => state.customCalendars);
}

export function useCustomCalendarActions() {
  return useDashboardStore((state) => ({
    addCustomCalendar: state.addCustomCalendar,
    updateCustomCalendar: state.updateCustomCalendar,
    deleteCustomCalendar: state.deleteCustomCalendar
  }));
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
