export type ThreadMeta = { threadId: string; activeCourseId?: string };

const meta = new Map<string, ThreadMeta>();

export function setActiveCourse(threadId: string, courseId?: string) {
  meta.set(threadId, { threadId, activeCourseId: courseId });
}

export function getActiveCourse(threadId: string) {
  return meta.get(threadId)?.activeCourseId;
}
