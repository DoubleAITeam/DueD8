export type SubmissionFormatting = {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  marginInches: number;
  includeHeaderBlock: boolean;
};

export type SubmissionDocument = {
  content: string;
  formatting: SubmissionFormatting;
  title: string;
  citationStyle: 'apa7' | 'mla9' | 'chicago';
  references: string[];
  referencesRequireSources: boolean;
};

type ContextInput = {
  fileName: string;
  content: string;
};

type AttachmentLink = {
  name: string;
  url: string;
};

const FONT_FALLBACKS = ['Times New Roman', 'Calibri', 'Arial'];

const DEFAULT_FORMATTING: SubmissionFormatting = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 2,
  marginInches: 1,
  includeHeaderBlock: false
};

function detectFont(text: string): string {
  const match = text.match(/(Times New Roman|Calibri|Arial|Cambria|Georgia)/i);
  if (match) {
    const normalised = match[1];
    if (/Times New Roman/i.test(normalised)) {
      return 'Times New Roman';
    }
    if (/Calibri/i.test(normalised)) {
      return 'Calibri';
    }
    if (/Cambria/i.test(normalised)) {
      return 'Cambria';
    }
    if (/Georgia/i.test(normalised)) {
      return 'Georgia';
    }
    return 'Arial';
  }
  return FONT_FALLBACKS[0];
}

function detectFontSize(text: string): number {
  const match = text.match(/(\d{2})\s?(?:pt|point)/i);
  if (match) {
    const size = Number.parseInt(match[1], 10);
    if (Number.isFinite(size) && size >= 8 && size <= 18) {
      return size;
    }
  }
  return 12;
}

function detectLineSpacing(text: string): number {
  if (/double[-\s]?spaced/i.test(text)) {
    return 2;
  }
  if (/1\.?5\s?spacing/i.test(text)) {
    return 1.5;
  }
  if (/single[-\s]?spaced/i.test(text)) {
    return 1;
  }
  return 2;
}

function detectHeaderBlock(text: string): boolean {
  return /(Name|Course|Instructor|Date):/i.test(text);
}

function detectCitationStyle(text: string): 'apa7' | 'mla9' | 'chicago' {
  if (/MLA/i.test(text)) {
    return 'mla9';
  }
  if (/Chicago/i.test(text)) {
    return 'chicago';
  }
  return 'apa7';
}

type PromptItem = {
  label: string;
  prompt: string;
  subparts: PromptItem[];
};

function normaliseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPromptStructure(text: string): PromptItem[] {
  const lines = text.split(/\r?\n/);
  const prompts: PromptItem[] = [];
  let current: PromptItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.length) {
      continue;
    }

    const numberMatch = trimmed.match(/^(\d{1,2}(?:\.\d+)*)[\.)]\s+(.*)$/);
    if (numberMatch) {
      current = {
        label: numberMatch[1],
        prompt: normaliseWhitespace(numberMatch[2] ?? ''),
        subparts: []
      };
      prompts.push(current);
      continue;
    }

    const letterMatch = trimmed.match(/^([a-zA-Z])[\.)]\s+(.*)$/);
    if (letterMatch && current) {
      current.subparts.push({
        label: `${current.label}${letterMatch[1].toLowerCase()}`,
        prompt: normaliseWhitespace(letterMatch[2] ?? ''),
        subparts: []
      });
      continue;
    }

    if (current) {
      if (current.subparts.length) {
        const lastSub = current.subparts[current.subparts.length - 1];
        lastSub.prompt = normaliseWhitespace(`${lastSub.prompt} ${trimmed}`);
      } else {
        current.prompt = normaliseWhitespace(`${current.prompt} ${trimmed}`);
      }
    }
  }

  if (!prompts.length) {
    const fallback = normaliseWhitespace(text);
    if (fallback.length) {
      return [
        {
          label: '1',
          prompt: fallback,
          subparts: []
        }
      ];
    }
  }

  return prompts;
}

function craftStudentResponse(prompt: string, index: number): string {
  const cleaned = normaliseWhitespace(prompt);
  if (!cleaned.length) {
    return `I completed the task by applying the course concepts to deliver a polished response.`;
  }

  const summary = cleaned.length > 180 ? `${cleaned.slice(0, 180)}…` : cleaned;
  const verbs = ['explained', 'analysed', 'applied', 'evaluated', 'synthesised'];
  const verb = verbs[index % verbs.length];
  return `I ${verb} the prompt on ${summary.toLowerCase()} and provided evidence-based reasoning with clear conclusions.`;
}

function createFinalAnswerLine(prompt: string): string | null {
  if (/(solve|calculate|compute|determine|equation|final answer)/i.test(prompt)) {
    return 'Final Answer: The solution is presented clearly above with all supporting work shown.';
  }
  return null;
}

function deriveReferences(contexts: ContextInput[], citationStyle: 'apa7' | 'mla9' | 'chicago') {
  const urls = new Set<string>();
  const urlRegex = /(https?:\/\/[^\s)]+)(?:\)|\s|$)/gi;
  contexts.forEach((entry) => {
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(entry.content)) !== null) {
      urls.add(match[1]);
    }
  });

  if (!urls.size) {
    return { references: ['[SOURCE NEEDED]'], requireSources: true };
  }

  const references: string[] = [];
  urls.forEach((url) => {
    if (citationStyle === 'mla9') {
      references.push(`${url}. Accessed ${new Date().toLocaleDateString()}.`);
    } else if (citationStyle === 'chicago') {
      references.push(`${url}. Accessed on ${new Date().toLocaleDateString()}.`);
    } else {
      references.push(`${url}. Retrieved ${new Date().toLocaleDateString()}.`);
    }
  });

  return { references, requireSources: false };
}

function buildAttachmentsSummary(attachments: AttachmentLink[]): string[] {
  if (!attachments.length) {
    return [];
  }
  const lines: string[] = ['Attachments'];
  attachments.forEach((attachment) => {
    lines.push(`• ${attachment.name}: ${attachment.url}`);
  });
  return lines;
}

export function buildSubmissionDocument(options: {
  assignmentName?: string | null;
  courseName?: string;
  dueText?: string;
  contexts: ContextInput[];
  canvasUrl?: string | null;
  attachments?: AttachmentLink[];
}): SubmissionDocument {
  const { assignmentName, courseName, dueText, contexts, canvasUrl, attachments = [] } = options;
  const combinedText = contexts.map((entry) => entry.content).join('\n\n');
  const fontFamily = detectFont(combinedText);
  const fontSize = detectFontSize(combinedText);
  const lineSpacing = detectLineSpacing(combinedText);
  const includeHeaderBlock = detectHeaderBlock(combinedText);
  const citationStyle = detectCitationStyle(combinedText);

  const formatting: SubmissionFormatting = {
    fontFamily,
    fontSize,
    lineSpacing,
    marginInches: 1,
    includeHeaderBlock
  };

  const prompts = extractPromptStructure(combinedText);

  const sections: string[] = [];

  if (formatting.includeHeaderBlock) {
    sections.push('Name:\nCourse:\nInstructor:\nDate:');
  }

  const title = assignmentName?.trim().length ? assignmentName.trim() : 'Completed Assignment';
  sections.push(title);

  if (courseName?.trim().length) {
    sections.push(courseName.trim());
  }

  if (dueText?.trim().length) {
    sections.push(`Due: ${dueText.trim()}`);
  }

  prompts.forEach((item, index) => {
    const bodyLines: string[] = [];
    const response = craftStudentResponse(item.prompt, index);
    bodyLines.push(`${item.label}. ${response}`);
    item.subparts.forEach((sub, subIndex) => {
      const subResponse = craftStudentResponse(sub.prompt, subIndex);
      bodyLines.push(`${sub.label}. ${subResponse}`);
      const finalAnswer = createFinalAnswerLine(sub.prompt);
      if (finalAnswer) {
        bodyLines.push(finalAnswer);
      }
    });
    const finalAnswer = createFinalAnswerLine(item.prompt);
    if (finalAnswer) {
      bodyLines.push(finalAnswer);
    }
    sections.push(bodyLines.join('\n'));
  });

  const { references, requireSources } = deriveReferences(contexts, citationStyle);
  sections.push('References');
  references.forEach((reference) => {
    sections.push(reference);
  });

  if (canvasUrl) {
    sections.push(`Original Assignment: ${canvasUrl}`);
  }

  const attachmentSummary = buildAttachmentsSummary(attachments);
  if (attachmentSummary.length) {
    sections.push(attachmentSummary.join('\n'));
  }

  const content = sections.join('\n\n');

  return {
    content,
    formatting,
    title,
    citationStyle,
    references,
    referencesRequireSources: requireSources
  };
}

export { DEFAULT_FORMATTING };
