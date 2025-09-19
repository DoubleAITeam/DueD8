export type CleanInput = {
  title?: string;
  prompts: string[];
  rubric?: string[];
  constraints?: string[];
  course?: string;
};

const DROP_HEADINGS = [
  'Important Reminders',
  'Late homework',
  'Plagiarism',
  'Submission format',
  'Please submit this as a PDF',
  'Department Chair'
];

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAssignment(raw: string): CleanInput {
  const text = stripHtml(raw);
  const lines = text.split(/\n|\. {0,1}\n?/).map((s) => s.trim());

  const keep: string[] = [];
  for (const line of lines) {
    const drop = DROP_HEADINGS.some((h) => line.toLowerCase().includes(h.toLowerCase()));
    if (!drop && line && line.length < 1200) keep.push(line);
  }

  const prompts: string[] = [];
  const rubric: string[] = [];
  for (const l of keep) {
    if (/^rubric[:]?/i.test(l) || /meets? the expectation/i.test(l)) rubric.push(l);
    else prompts.push(l);
  }

  return { prompts, rubric };
}
