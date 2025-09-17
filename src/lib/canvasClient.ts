import type { IpcResult } from '../shared/ipc';

export type Course = {
  id: number;
  name: string;
  course_code?: string;
};

export type Assignment = {
  id: number;
  name: string;
  course_id: number;
  due_at: string | null;
  html_url?: string;
};

export type CalendarEvent = {
  id: number;
  title: string;
  start_at: string;
  end_at?: string | null;
  context_name?: string;
  html_url?: string;
};

function canvasGet(payload: { path: string; query?: Record<string, string | number | boolean> }) {
  return window.dued8.canvas.get(payload) as Promise<IpcResult<unknown>>;
}

/**
 * Fetch the authenticated user's Canvas profile through IPC.
 */
export async function getUserProfile() {
  return canvasGet({ path: '/api/v1/users/self/profile' });
}

/**
 * Fetch the list of active Canvas courses for the current user.
 */
export async function getCourses() {
  return canvasGet({ path: '/api/v1/courses', query: { enrollment_state: 'active' } }) as Promise<IpcResult<Course[]>>;
}

/**
 * Fetch upcoming assignments for a given course.
 * TODO: Extend to handle pagination when there are more than 10 upcoming assignments.
 */
export async function getAssignments(courseId: number) {
  return canvasGet({
    path: `/api/v1/courses/${courseId}/assignments`,
    query: { bucket: 'upcoming' }
  }) as Promise<IpcResult<Assignment[]>>;
}

/**
 * Fetch Canvas calendar events inside a date window.
 */
export async function getCalendarEvents(startISO: string, endISO: string) {
  return canvasGet({
    path: '/api/v1/calendar_events',
    query: { type: 'assignment', start_date: startISO, end_date: endISO }
  }) as Promise<IpcResult<CalendarEvent[]>>;
}

