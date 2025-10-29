import { randomUUID } from "crypto";
import type { SyllabusChunk, StudentProfile } from "./types";

const chunkStore = new Map<string, SyllabusChunk>();
let profile: StudentProfile | null = null;

export async function upsertStudentProfile(p: StudentProfile) {
  profile = structuredClone(p);
}

export async function ingestSyllabus(courseId: string, chunks: Array<Omit<SyllabusChunk, "id" | "courseId">>) {
  for (const chunk of chunks) {
    const id = randomUUID();
    chunkStore.set(id, {
      id,
      ...chunk,
      courseId,
    });
  }
}

export function getProfile() {
  return profile ? structuredClone(profile) : null;
}

export function getCourseChunks(courseId: string) {
  return Array.from(chunkStore.values()).filter((chunk) => chunk.courseId === courseId);
}

export function clearContextStore() {
  chunkStore.clear();
  profile = null;
}
