import type { IpcResult } from '../shared/ipc';
import { getPlatformBridge } from './platformBridge';

export type CourseEnrollment = {
  computed_current_grade?: string | null;
  computed_current_score?: number | null;
  computed_final_grade?: string | null;
  computed_final_score?: number | null;
  grades?: {
    current_grade?: string | null;
    current_score?: number | null;
    final_grade?: string | null;
    final_score?: number | null;
  };
};

export type Course = {
  id: number;
  name: string;
  course_code?: string;
  syllabus_body?: string | null;
  enrollments?: CourseEnrollment[];
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

type CanvasQueryValue = string | number | boolean | Array<string | number | boolean>;

function canvasGet(payload: { path: string; query?: Record<string, CanvasQueryValue> }) {
  return getPlatformBridge().canvas.get(payload) as Promise<IpcResult<unknown>>;
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
  return canvasGet({
    path: '/api/v1/courses',
    query: {
      enrollment_state: 'active',
      // PHASE 4: Retrieve syllabus and score metadata for grade display.
      'include[]': ['syllabus_body', 'total_scores', 'current_grading_period_scores', 'enrollments']
    }
  }) as Promise<IpcResult<Course[]>>;
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
 * Fetch past-due assignments for a given course so users can revisit old work.
 */
export async function getPastAssignments(courseId: number) {
  return canvasGet({
    path: `/api/v1/courses/${courseId}/assignments`,
    query: { bucket: 'past' }
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

