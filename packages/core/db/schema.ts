export type SyllabusSection =
  | "overview"
  | "policy"
  | "schedule"
  | "reading"
  | "assignment";

export interface SyllabusChunk {
  id: string;
  courseId: string;
  dateISO: string | null;
  section: SyllabusSection;
  heading: string | null;
  text: string;
  tokens: number;
}

export interface StudentProfileCourse {
  courseId: string;
  title: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  school: string;
  courses: StudentProfileCourse[];
  prefs?: Record<string, unknown>;
}
