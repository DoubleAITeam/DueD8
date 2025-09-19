import { callLLM } from '../provider';
import type { CleanInput } from './sanitize';

export type Deliverable = {
  title?: string;
  sections: { heading: string; body: string }[];
  references?: string[];
};

const schemaPrompt = `
You write the student's deliverable only.
Do not include due dates, submission rules, plagiarism text, Canvas links, or raw HTML.
Do not mention the rubric by name. Satisfy it implicitly.
Output only JSON that matches:
{
  "title": "string optional",
  "sections": [{"heading": "string", "body": "string"}, ...],
  "references": ["string", ...]  // omit if none
}
Do not output placeholders like [SOURCE NEEDED].
If no sources are used, omit "references".
`;

export async function writeDeliverable(clean: CleanInput): Promise<Deliverable> {
  const user = JSON.stringify({
    task: clean.prompts.slice(0, 10),
    rubric: clean.rubric?.slice(0, 15)
  });

  const raw = await callLLM({
    system: schemaPrompt,
    user,
    temperature: 0.2,
    top_p: 0.9,
    seed: 7
  });

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Schema validation failed');
  }
  return parsed as Deliverable;
}
