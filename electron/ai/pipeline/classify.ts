import { callLLM } from '../provider';
import type { CleanInput } from './sanitize';

export type AssignmentType = 'instructions' | 'deliverable_needed';

export async function classify(clean: CleanInput): Promise<AssignmentType> {
  const prompt = [
    'Decide if the user provided text is only instructions or if it requests a student deliverable.',
    'Return JSON with one field: {"type":"instructions"|"deliverable_needed"}.',
    'If it only lists rules, due dates, plagiarism, or submission formats, label as instructions.',
    'If it asks the student to write, analyze, design, or compute, label as deliverable_needed.'
  ].join('\n');

  const res = await callLLM({
    system: 'Return only valid JSON.',
    user: `${prompt}\nTEXT:\n${JSON.stringify(clean)}`,
    temperature: 0
  });

  const parsed = JSON.parse(res);
  return parsed.type;
}
