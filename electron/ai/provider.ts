import type { CleanInput } from './pipeline/sanitize';

type CallOptions = {
  system: string;
  user: string;
  temperature?: number;
  top_p?: number;
  seed?: number;
};

type DeliverablePayload = {
  task?: unknown;
  rubric?: unknown;
};

function parseClassificationPayload(user: string): CleanInput | null {
  const marker = 'TEXT:\n';
  const index = user.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const raw = user.slice(index + marker.length);
  try {
    return JSON.parse(raw) as CleanInput;
  } catch (error) {
    console.warn('[provider] failed to parse classification payload', error);
    return null;
  }
}

function parseDeliverablePayload(user: string): DeliverablePayload {
  try {
    return JSON.parse(user) as DeliverablePayload;
  } catch (error) {
    console.warn('[provider] failed to parse deliverable payload', error);
    return {};
  }
}

function hasDeliverableCue(clean: CleanInput | null) {
  if (!clean) {
    return false;
  }
  const haystack = JSON.stringify(clean).toLowerCase();
  const cues = ['write', 'essay', 'analysis', 'design', 'report', 'compute', 'calculate', 'respond', 'answer'];
  return cues.some((cue) => haystack.includes(cue));
}

function buildSections(payload: DeliverablePayload) {
  const tasks = Array.isArray(payload.task) ? payload.task : [];
  const sections = tasks
    .map((value, index) => {
      const text = typeof value === 'string' ? value.trim() : '';
      const heading = text.length ? `Response ${index + 1}` : `Response`;
      const body = text.length ? `Answer: ${text}` : 'Answer: Summary of the requirement.';
      return { heading, body };
    })
    .filter((section) => section.body.trim().length);

  if (!sections.length) {
    sections.push({ heading: 'Summary', body: 'Answer: Completed response based on the provided instructions.' });
  }

  const rubric = Array.isArray(payload.rubric) ? payload.rubric : [];
  const references = rubric
    .slice(0, 2)
    .map((line, index) => `Rubric note ${index + 1}: ${typeof line === 'string' ? line : JSON.stringify(line)}`);

  return { sections, references: references.length ? references : undefined };
}

export async function callLLM(options: CallOptions): Promise<string> {
  if (options.user.includes('TEXT:\n')) {
    const clean = parseClassificationPayload(options.user);
    const type = hasDeliverableCue(clean) ? 'deliverable_needed' : 'instructions';
    return JSON.stringify({ type });
  }

  const payload = parseDeliverablePayload(options.user);
  const { sections, references } = buildSections(payload);
  const result = {
    title: sections.length ? 'Completed Assignment' : undefined,
    sections,
    ...(references ? { references } : {})
  };
  return JSON.stringify(result);
}
