import { getProfile } from "./store";
import { retrieveContext } from "./retriever";

export type ContextPack = {
  systemDirectives: string;
  studentSummary?: string;
  syllabusSnippets: Array<{ heading: string | null; dateISO: string | null; text: string }>;
};

type BuildOpts = { courseId?: string; query: string; k?: number; tokenBudget?: number };
const approxTokens = (s: string) => Math.ceil(s.length / 4);

export async function buildContextPack(opts: BuildOpts): Promise<ContextPack> {
  const profile = getProfile();
  const snippets: ContextPack["syllabusSnippets"] = [];

  if (opts.courseId) {
    const results = retrieveContext({ courseId: opts.courseId, query: opts.query, k: opts.k ?? 6, today: new Date() });
    const budget = opts.tokenBudget ?? 1200;
    let used = 0;
    for (const r of results) {
      const t = r.text.slice(0, 1200);
      const add = approxTokens(t);
      if (used + add > budget) break;
      used += add;
      snippets.push({ heading: r.heading ?? null, dateISO: r.dateISO ?? null, text: t });
    }
  }

  const studentSummary = profile
    ? `Student: ${profile.name}\nSchool: ${profile.school}\nCourses: ${profile.courses.map(c => c.title).join(", ")}`
    : undefined;

  const systemDirectives =
    "You are DueD8 Study Twin. Use the student profile and the syllabus snippets as the source of truth. " +
    "Cite headings and dates when answering. If information is missing, say what field is needed.";

  return { systemDirectives, studentSummary, syllabusSnippets: snippets };
}
