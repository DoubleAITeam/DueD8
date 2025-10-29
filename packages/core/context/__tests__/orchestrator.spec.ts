import { afterEach, expect, test } from "vitest";
import { buildContextPack } from "../orchestrator";
import { ingestSyllabus, upsertStudentProfile, clearContextStore } from "../store";

afterEach(() => {
  clearContextStore();
});

test("buildContextPack pulls assignment chunks for assignment query", async () => {
  await upsertStudentProfile({
    id: "s1",
    name: "Ahmed Mohamed",
    school: "GMU",
    courses: [{ courseId: "IT-214-007", title: "IT-214" }]
  });

  await ingestSyllabus("IT-214-007", [
    {
      courseId: "IT-214-007",
      dateISO: "2025-10-31",
      section: "assignment",
      heading: "HW2",
      text: "Submit ERD and SQL by 10/31",
      tokens: 40
    } as any
  ]);

  const pack = await buildContextPack({ courseId: "IT-214-007", query: "When is HW2 due", k: 4 });
  const joined = pack.syllabusSnippets.map((s) => s.text).join(" ");
  expect(joined).toMatch(/10\/31/);
});
