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
    const normalized = prompts.map((line) => line.toLowerCase());

    const directivePattern =
      /\b(write|analyz|design|creat|draft|respond|compute|explain|discuss|describe|compare|evaluate|assess|reflect|answer|summarize|prepare|perform|develop|calculate|solve|research|argue|outline|present|compose|critique|review|explore|investigate|build|engineer|examine|complete|address|provide|list|identify|propose|construct|choose|select|support)\b/;

    const academicNounPattern =
      /\b(essay|paper|report|project|presentation|analysis|reflection|discussion|case study|lab|assignment prompt|deliverable)\b/;

    const rulePattern =
      /(submit|policy|syllabus|plagiarism|late|reminder|format|deadline|due|extension|penalt|grading|points|instructor|contact|office hours|email|academic integrity|important information)/;

    const hasDirective = normalized.some((line) => directivePattern.test(line));
    const hasQuestion = normalized.some((line) => line.includes('?'));
    const mentionsAcademicWork = normalized.some((line) => academicNounPattern.test(line));
    const hasOnlyRules =
      normalized.length > 0 &&
      normalized.every((line) => rulePattern.test(line) || line.length <= 3);

    const shouldTreatAsDeliverable =
      normalized.length > 0 &&
      !hasOnlyRules &&
      (hasDirective || hasQuestion || mentionsAcademicWork || rubric.length > 0);

    const type = shouldTreatAsDeliverable ? 'deliverable_needed' : 'instructions';
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
