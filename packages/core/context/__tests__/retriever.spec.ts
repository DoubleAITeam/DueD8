import { describe, it, beforeEach, expect } from "vitest";
import { retrieveContext } from "../retriever";
import { clearContextStore, ingestSyllabus, upsertStudentProfile, getProfile } from "../store";
import type { StudentProfile } from "../types";
import { normalizeSyllabus } from "../../../utils/normalizers/syllabus";

const COURSE_ID = "math-101";

describe("context retriever", () => {
  beforeEach(() => {
    clearContextStore();
  });

  it("prioritizes matching keywords and section boosts", async () => {
    await ingestSyllabus(COURSE_ID, [
      {
        heading: "Week 1 - Limits",
        text: "Lecture introduces limits and convergence concepts.",
        section: "schedule",
        dateISO: "2024-01-10",
        tokens: 10,
      },
      {
        heading: "Homework 1",
        text: "Assignment on limits, submit via LMS.",
        section: "assignment",
        dateISO: "2024-01-12",
        tokens: 9,
      },
      {
        heading: "Reading 1",
        text: "Read chapter 1 on limits and continuity.",
        section: "reading",
        dateISO: "2024-01-09",
        tokens: 9,
      },
    ]);

    const results = retrieveContext({
      courseId: COURSE_ID,
      query: "limits homework",
      today: new Date("2024-01-11"),
      k: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].section).toBe("assignment");
    expect(results[0].heading).toContain("Homework");
    expect(results[1].section).toBe("schedule");
  });

  it("prefers recent entries when scores tie", async () => {
    await ingestSyllabus(COURSE_ID, [
      {
        heading: "Project kickoff",
        text: "Discuss final project requirements.",
        section: "overview",
        dateISO: "2024-03-01",
        tokens: 7,
      },
      {
        heading: "Project wrap-up",
        text: "Finalize submissions and peer review.",
        section: "overview",
        dateISO: "2024-04-15",
        tokens: 7,
      },
    ]);

    const results = retrieveContext({
      courseId: COURSE_ID,
      query: "project",
      today: new Date("2024-04-16"),
      k: 2,
    });

    expect(results[0].heading).toContain("wrap-up");
    expect(results[1].heading).toContain("kickoff");
  });

  it("falls back to general context when query is empty", async () => {
    await ingestSyllabus(COURSE_ID, [
      {
        heading: "Course overview",
        text: "Welcome to the course.",
        section: "overview",
        dateISO: null,
        tokens: 5,
      },
    ]);

    const results = retrieveContext({
      courseId: COURSE_ID,
      query: " ",
      today: new Date("2024-04-16"),
    });

    expect(results).toHaveLength(1);
    expect(results[0].section).toBe("overview");
  });
});

describe("student profile store", () => {
  beforeEach(() => {
    clearContextStore();
  });

  it("stores and retrieves the latest profile", async () => {
    const profile: StudentProfile = {
      id: "student-1",
      name: "Ada Lovelace",
      school: "Analytical Academy",
      courses: [
        { courseId: "math-101", title: "Calculus" },
      ],
      prefs: { timezone: "UTC" },
    };

    await upsertStudentProfile(profile);

    expect(getProfile()).toEqual(profile);
  });
});

describe("syllabus normalization", () => {
  it("extracts sections and metadata from simple HTML", async () => {
    const html = `
      <h1>Course Policies</h1>
      <p>Attendance policy is mandatory.</p>
      <h2>Week 1 - Limits (Jan 10, 2024)</h2>
      <p>Lecture on limits.</p>
      <h2>Homework 1</h2>
      <p>Submit Assignment via LMS by 01/12.</p>
    `;

    const chunks = await normalizeSyllabus({ data: html, mimeType: "text/html" });

    expect(chunks).toHaveLength(3);
    const policy = chunks[0];
    expect(policy.section).toBe("policy");
    const schedule = chunks[1];
    expect(schedule.section).toBe("schedule");
    expect(schedule.dateISO).toBe("2024-01-10");
    const assignment = chunks[2];
    expect(assignment.section).toBe("assignment");
    expect(assignment.dateISO).toBe("2024-01-12");
  });
});
