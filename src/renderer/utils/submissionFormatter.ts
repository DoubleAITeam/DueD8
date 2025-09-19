import type { AssignmentContextEntry } from '../state/store';

export type SubmissionFormatting = {
  fontFamily: string;
  fontSize: number;
  lineSpacing: 'single' | 'double' | 'one-and-half';
  marginInches: number;
  fontColor: string;
};

export type SubmissionDocument = {
  title: string;
  headerLines: string[];
  paragraphs: string[];
  references: string[];
  citationStyle: string;
  formatting: SubmissionFormatting;
  missingSources: boolean;
  upgradeRequired: boolean;
  incompleteSections: string[];
  canvasLink?: string | null;
  attachmentLinks: Array<{ name: string; url?: string | null }>;
};

type BuildSubmissionOptions = {
  assignmentName?: string | null;
  courseName?: string;
  dueText?: string;
  contexts: Array<Pick<AssignmentContextEntry, 'fileName' | 'content'>>;
  canvasLink?: string | null;
  attachments?: Array<{ name: string; url?: string | null }>;
};

type PromptSection = {
  label: string;
  prompt: string;
  depth: number;
  children: PromptSection[];
};

function selectPrimaryContext(contexts: BuildSubmissionOptions['contexts']) {
  if (!contexts.length) {
    return null;
  }
  return [...contexts].sort((a, b) => b.content.length - a.content.length)[0];
}

function detectFormatting(text: string): SubmissionFormatting {
  const lower = text.toLowerCase();
  let fontFamily = 'Times New Roman';
  if (lower.includes('calibri')) {
    fontFamily = 'Calibri';
  } else if (lower.includes('arial')) {
    fontFamily = 'Arial';
  } else if (lower.includes('garamond')) {
    fontFamily = 'Garamond';
  }

  let fontSize = 12;
  if (/(11\s?pt|size\s*11)/i.test(text)) {
    fontSize = 11;
  } else if (/(10\s?pt|size\s*10)/i.test(text)) {
    fontSize = 10;
  } else if (/(13\s?pt|size\s*13)/i.test(text)) {
    fontSize = 13;
  }

  let lineSpacing: SubmissionFormatting['lineSpacing'] = 'double';
  if (/single\s*spaced/i.test(text)) {
    lineSpacing = 'single';
  } else if (/(1\.5\s*spacing|1\.5\s*spaced)/i.test(text)) {
    lineSpacing = 'one-and-half';
  }

  let marginInches = 1;
  const marginMatch = text.match(/(\d(?:\.\d)?)\s*(?:inch|in\.?|\")\s*margins?/i);
  if (marginMatch) {
    const parsed = Number.parseFloat(marginMatch[1]);
    if (!Number.isNaN(parsed) && parsed > 0.3 && parsed < 3) {
      marginInches = parsed;
    }
  }

  let fontColor = '#000000';
  const colorMatch = text.match(/#([0-9a-f]{6})/i);
  if (colorMatch) {
    fontColor = `#${colorMatch[1]}`;
  } else if (/dark blue/i.test(text)) {
    fontColor = '#0b2545';
  }

  return { fontFamily, fontSize, lineSpacing, marginInches, fontColor };
}

function detectCitationStyle(text: string) {
  if (/apa\s*(?:7|7th)/i.test(text)) {
    return 'APA 7';
  }
  if (/apa/i.test(text)) {
    return 'APA 7';
  }
  if (/mla\s*(?:9|9th)/i.test(text)) {
    return 'MLA 9';
  }
  if (/mla/i.test(text)) {
    return 'MLA 9';
  }
  if (/chicago/i.test(text)) {
    return 'Chicago';
  }
  if (/harvard/i.test(text)) {
    return 'Harvard';
  }
  return 'APA 7';
}

function requiresHeaderBlock(text: string) {
  return /include your name|name[:\-]|instructor|course[:\-]|date[:\-]/i.test(text);
}

function normaliseWhitespace(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function classifyLine(line: string) {
  const numberMatch = line.match(/^(\d+)[.)]\s*(.+)$/);
  if (numberMatch) {
    return { depth: 0, label: `${numberMatch[1]}.`, prompt: numberMatch[2].trim() };
  }
  const alphaMatch = line.match(/^([a-z])[.)]\s*(.+)$/i);
  if (alphaMatch) {
    return { depth: 1, label: `${alphaMatch[1].toLowerCase()})`, prompt: alphaMatch[2].trim() };
  }
  const romanMatch = line.match(/^(?:(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))[.)]\s*(.+)$/i);
  if (romanMatch) {
    const label = line.split(/[.)]/)[0];
    return { depth: 2, label: `${label.toLowerCase()}.`, prompt: romanMatch[romanMatch.length - 1].trim() };
  }
  const bulletMatch = line.match(/^(?:[-*•])\s+(.+)$/);
  if (bulletMatch) {
    return { depth: 3, label: '•', prompt: bulletMatch[1].trim() };
  }
  return null;
}

function parsePromptSections(text: string): PromptSection[] {
  const sections: PromptSection[] = [];
  const stack: PromptSection[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);

  for (const line of lines) {
    const classified = classifyLine(line);
    if (classified) {
      const { depth, label, prompt } = classified;
      const section: PromptSection = { label, prompt, depth, children: [] };
      while (stack.length && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      if (!stack.length) {
        sections.push(section);
      } else {
        stack[stack.length - 1].children.push(section);
      }
      stack.push(section);
      continue;
    }

    if (!stack.length) {
      sections.push({ label: '', prompt: line, depth: 0, children: [] });
      stack.push(sections[sections.length - 1]);
      continue;
    }

    const current = stack[stack.length - 1];
    current.prompt = `${current.prompt} ${line}`.trim();
  }

  return sections;
}

function flattenSections(sections: PromptSection[], maxDepth = 2): PromptSection[] {
  const result: PromptSection[] = [];
  const walk = (entries: PromptSection[]) => {
    for (const entry of entries) {
      result.push(entry);
      if (entry.depth < maxDepth && entry.children.length) {
        walk(entry.children);
      }
    }
  };
  walk(sections);
  return result;
}

function craftAnswerSentence(prompt: string, depth: number, courseName?: string) {
  const cleaned = prompt
    .replace(/^[^:]+:\s*/, '')
    .replace(/\*+/g, '')
    .trim();
  const lowered = cleaned.toLowerCase();
  const topic = cleaned.endsWith('.') ? cleaned.slice(0, -1) : cleaned;
  if (/calculate|solve|determine|equation|find the value|compute/i.test(lowered)) {
    return {
      lines: [
        'Work: I set up the relevant expressions using the figures given and simplify each step clearly.',
        'Final Answer: The completed calculation aligns with the method we practised in class.'
      ],
      mode: 'problem' as const
    };
  }
  if (/discuss|explain|analyze|analyse|compare|reflect|essay|paper/i.test(lowered)) {
    const reference = courseName ? `from ${courseName}` : 'from class';
    return {
      lines: [
        `I open with a direct response that states my position and summarises the core evidence ${reference}.`,
        'I follow with specific supporting details and examples that mirror the order requested in the prompt.'
      ],
      mode: 'essay' as const
    };
  }
  if (/describe|summarize|outline|provide/i.test(lowered)) {
    return {
      lines: [
        'I respond plainly in the first person, covering each expectation in sequence.',
        'I close with a concise statement that signals the requirement has been satisfied.'
      ],
      mode: 'short' as const
    };
  }
  if (depth > 0) {
    return {
      lines: [
        'I answer in full sentences that connect directly to the parent section and cite the necessary evidence.'
      ],
      mode: 'short' as const
    };
  }
  return {
    lines: [
      'I deliver a precise response written in a student voice, matching the order and detail requested.',
      'I ensure the paragraph ends with a clear statement that addresses the prompt completely.'
    ],
    mode: 'short' as const
  };
}

function buildHeaderLines(options: BuildSubmissionOptions, formatting: SubmissionFormatting) {
  const lines: string[] = [];
  if (requiresHeaderBlock(options.contexts.map((c) => c.content).join('\n'))) {
    lines.push('Name: ____________________');
    if (options.courseName) {
      lines.push(`Course: ${options.courseName}`);
    } else {
      lines.push('Course: ____________________');
    }
    lines.push('Instructor: ____________________');
    lines.push('Date: ____________________');
  }
  if (options.assignmentName) {
    lines.push(options.assignmentName.trim());
  }
  if (options.dueText) {
    lines.push(`Due: ${options.dueText}`);
  }
  return lines;
}

function buildReferences(options: BuildSubmissionOptions, citationStyle: string) {
  const references: string[] = [];
  const usedNames = new Set<string>();
  options.contexts.forEach((context, index) => {
    const baseName = context.fileName.replace(/\.[^.]+$/, '');
    const uniqueName = usedNames.has(baseName) ? `${baseName} (${index + 1})` : baseName;
    usedNames.add(uniqueName);
    if (/apa/i.test(citationStyle)) {
      references.push(`${uniqueName}. (n.d.). Course materials. Unpublished manuscript.`);
    } else if (/mla/i.test(citationStyle)) {
      references.push(`${uniqueName}. Course handout. n.d.`);
    } else {
      references.push(`${uniqueName}. Course resource.`);
    }
  });
  references.push('[SOURCE NEEDED] Provide your references before submission.');
  return references;
}

export function buildSubmissionDocument(options: BuildSubmissionOptions): SubmissionDocument {
  const { assignmentName, courseName, contexts, canvasLink, attachments } = options;
  const primaryContext = selectPrimaryContext(contexts);
  const combinedText = contexts.map((context) => normaliseWhitespace(context.content)).join('\n\n');
  const formatting = detectFormatting(combinedText);
  const citationStyle = detectCitationStyle(combinedText);
  const headerLines = buildHeaderLines(options, formatting);
  const sections = parsePromptSections(primaryContext?.content ?? combinedText);
  const flattened = flattenSections(sections);
  const MAX_SECTIONS = 6;
  const processedSections = flattened.slice(0, MAX_SECTIONS);
  const upgradeRequired = flattened.length > MAX_SECTIONS;
  const incompleteSections = upgradeRequired
    ? flattened.slice(MAX_SECTIONS).map((section) => `${section.label ? `${section.label} ` : ''}${section.prompt}`.trim())
    : [];

  const paragraphs: string[] = [];
  processedSections.forEach((section) => {
    const labelPrefix = section.label ? `${section.label} ` : '';
    const promptLine = `${labelPrefix}${section.prompt}`.trim();
    if (promptLine.length) {
      paragraphs.push(promptLine);
    }
    const answer = craftAnswerSentence(section.prompt, section.depth, courseName);
    paragraphs.push(...answer.lines);
    if (answer.mode === 'problem') {
      paragraphs.push('Final Answer: The solution is formatted neatly for grading.');
    }
  });

  if (!paragraphs.length && primaryContext) {
    const cleaned = normaliseWhitespace(primaryContext.content);
    paragraphs.push('I present the submission in full paragraphs that align exactly with the assignment instructions.');
    if (cleaned.length > 200) {
      paragraphs.push(cleaned.slice(0, 200));
    }
  }

  const references = buildReferences(options, citationStyle);
  const missingSources = references.some((entry) => entry.includes('[SOURCE NEEDED]'));

  const attachmentLinks = (attachments ?? []).map((attachment) => ({
    name: attachment.name,
    url: attachment.url ?? null
  }));

  const title = assignmentName?.trim().length ? assignmentName.trim() : primaryContext?.fileName ?? 'Completed Assignment';

  return {
    title,
    headerLines,
    paragraphs,
    references,
    citationStyle,
    formatting,
    missingSources,
    upgradeRequired,
    incompleteSections,
    canvasLink,
    attachmentLinks
  };
}
