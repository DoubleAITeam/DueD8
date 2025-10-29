export type { SyllabusChunk, StudentProfile, SyllabusSection } from "../../core/db/schema";

export type RetrieveOpts = {
  courseId: string;
  query: string;
  k?: number;
  today?: Date;
};
