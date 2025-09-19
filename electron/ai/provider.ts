import type { CleanInput } from './pipeline/sanitize';

type LlmRequest = {
  system: string;
  user: string;
  temperature?: number;
  top_p?: number;
  seed?: number;
};

type ParsedClean = CleanInput & { constraints?: string[] };

function extractCleanInput(payload: string): ParsedClean | null {
  const marker = 'TEXT:\n';
  let jsonSegment: string | null = null;
  const markerIndex = payload.indexOf(marker);
  if (markerIndex >= 0) {
    jsonSegment = payload.slice(markerIndex + marker.length);
  } else {
    const braceIndex = payload.indexOf('{');
    if (braceIndex >= 0) {
      jsonSegment = payload.slice(braceIndex);
    }
  }
  if (!jsonSegment) {
    return null;
  }
  try {
    const parsed = JSON.parse(jsonSegment);
    if (parsed && typeof parsed === 'object') {
      return parsed as ParsedClean;
    }
  } catch {
    return null;
  }
  return null;
}

const defaultCall = async (request: LlmRequest): Promise<string> => {
  if (request.system.includes('Return only valid JSON')) {
    const clean = extractCleanInput(request.user);
    const prompts = clean?.prompts ?? [];
    const rubric = clean?.rubric ?? [];
    const hasDirective = prompts.some((line) =>
      /write|analyze|design|create|draft|respond|compute|explain/i.test(line)
    );
    const hasOnlyRules = !hasDirective && rubric.length === 0 && prompts.every((line) =>
      /submit|policy|syllabus|plagiarism|late|reminder|format/i.test(line)
    );
    const type = hasDirective && prompts.length > 0 && !hasOnlyRules ? 'deliverable_needed' : 'instructions';
    return JSON.stringify({ type });
  }

  if (request.system.includes('"sections"')) {
    let clean: ParsedClean | null = null;
    try {
      clean = JSON.parse(request.user) as ParsedClean;
    } catch {
      clean = extractCleanInput(request.user);
    }
    const prompts = clean?.task ?? clean?.prompts ?? [];
    const heading = Array.isArray(prompts) && prompts.length ? prompts[0] : 'Student Submission';
    const body = Array.isArray(prompts)
      ? prompts
          .slice(0, 3)
          .map((line, index) => `${index + 1}. ${line}`)
          .join('\n')
      : 'No prompt details provided.';
    const response = {
      title: clean?.title ?? heading,
      sections: [
        {
          heading: heading.length > 80 ? `${heading.slice(0, 77)}…` : heading,
          body: body.length ? body : 'Student response based on provided materials.'
        }
      ],
      references: clean?.rubric && clean.rubric.length ? clean.rubric.slice(0, 3) : undefined
    };
    if (!response.references) {
      delete (response as { references?: string[] }).references;
    }
    return JSON.stringify(response);
  }

  throw new Error('callLLM: Unsupported request payload');
};

let callLLMImpl: (request: LlmRequest) => Promise<string> = defaultCall;

export const callLLM = (request: LlmRequest): Promise<string> => callLLMImpl(request);

export function setCallLLM(mock: (request: LlmRequest) => Promise<string>) {
  callLLMImpl = mock;
}

export function resetCallLLM() {
  callLLMImpl = defaultCall;
}
