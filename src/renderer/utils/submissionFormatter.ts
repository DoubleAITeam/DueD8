import type { Assignment } from '../../lib/canvasClient';

export type FormattingPreferences = {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  marginInches: number;
  fontColor: string;
  headingAlignment: 'center' | 'left';
  includeHeader: boolean;
};

export const DEFAULT_FORMATTING: FormattingPreferences = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 2,
  marginInches: 1,
  fontColor: '#000000',
  headingAlignment: 'center',
  includeHeader: false
};

export type SubmissionSection = {
  id: string;
  label: string;
  prompt: string;
  kind: 'essay' | 'question' | 'problem';
  subparts: SubmissionSection[];
};

export type SubmissionDraft = {
  content: string;
  formatting: FormattingPreferences;
  citationStyle: string;
  references: string[];
  missingSources: boolean;
  truncated: boolean;
  sectionCount: { rendered: number; total: number };
};

export type BuildSubmissionOptions = {
  assignment?: Pick<Assignment, 'name' | 'description'> | null;
  courseName?: string;
  dueText?: string;
  contexts: Array<{ fileName: string; content: string }>;
  canvasLink?: string | null;
  attachmentLinks?: Array<{ name: string; url: string }>;
};

const MAX_SECTIONS_FREE = 8;

function cleanWhitespace(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function gatherTextFragments(options: BuildSubmissionOptions) {
  const fragments: string[] = [];
  if (options.assignment?.description) {
    fragments.push(options.assignment.description);
  }
  for (const context of options.contexts) {
    if (context.content.trim().length) {
      fragments.push(context.content);
    }
  }
  return fragments;
}

function detectFontFamily(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes('times new roman')) {
    return 'Times New Roman';
  }
  if (lowered.includes('calibri')) {
    return 'Calibri';
  }
  if (lowered.includes('cambria')) {
    return 'Cambria';
  }
  if (lowered.includes('georgia')) {
    return 'Georgia';
  }
  if (lowered.includes('arial')) {
    return 'Arial';
  }
  if (lowered.includes('garamond')) {
    return 'Garamond';
  }
  return DEFAULT_FORMATTING.fontFamily;
}

function detectFontSize(text: string) {
  const sizeMatch = text.match(/(\d{2})(?:\s?pt|\s?point|\s?font)/i);
  if (sizeMatch) {
    const parsed = Number.parseInt(sizeMatch[1], 10);
    if (!Number.isNaN(parsed) && parsed >= 10 && parsed <= 14) {
      return parsed;
    }
  }
  return DEFAULT_FORMATTING.fontSize;
}

function detectLineSpacing(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes('double-spaced') || lowered.includes('double spaced')) {
    return 2;
  }
  if (lowered.includes('single-spaced') || lowered.includes('single spaced')) {
    return 1;
  }
  if (lowered.includes('1.5 spacing') || lowered.includes('1.5-spaced')) {
    return 1.5;
  }
  return DEFAULT_FORMATTING.lineSpacing;
}

function detectMargins(text: string) {
  const match = text.match(/(\d(?:\.\d+)?)\s?-?inch\s+margin/i);
  if (match) {
    const parsed = Number.parseFloat(match[1]);
    if (!Number.isNaN(parsed) && parsed >= 0.5 && parsed <= 2) {
      return parsed;
    }
  }
  return DEFAULT_FORMATTING.marginInches;
}

function detectHeadingAlignment(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes('center the title') || lowered.includes('title should be centered')) {
    return 'center';
  }
  if (lowered.includes('left-align the title') || lowered.includes('title should be left-aligned')) {
    return 'left';
  }
  return DEFAULT_FORMATTING.headingAlignment;
}

function shouldIncludeHeader(text: string) {
  const lowered = text.toLowerCase();
  return (
    lowered.includes('student name') ||
    lowered.includes('course name') ||
    lowered.includes('instructor') ||
    lowered.includes('name:')
  );
}

function detectFormattingPreferences(options: BuildSubmissionOptions): FormattingPreferences {
  const fragments = gatherTextFragments(options);
  if (!fragments.length) {
    return DEFAULT_FORMATTING;
  }
  const combined = fragments.join('\n\n');
  return {
    fontFamily: detectFontFamily(combined),
    fontSize: detectFontSize(combined),
    lineSpacing: detectLineSpacing(combined),
    marginInches: detectMargins(combined),
    fontColor: DEFAULT_FORMATTING.fontColor,
    headingAlignment: detectHeadingAlignment(combined),
    includeHeader: shouldIncludeHeader(combined)
  };
}

function detectCitationStyle(options: BuildSubmissionOptions) {
  const fragments = gatherTextFragments(options);
  const combined = fragments.join(' ').toLowerCase();
  if (combined.includes('mla')) {
    return 'MLA 9';
  }
  if (combined.includes('chicago') || combined.includes('turabian')) {
    return 'Chicago';
  }
  if (combined.includes('apa')) {
    return 'APA 7';
  }
  return 'APA 7';
}

function normalisePrompt(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();
}

function classifySection(prompt: string): SubmissionSection['kind'] {
  const lowered = prompt.toLowerCase();
  if (/(solve|calculate|compute|determin(e|ing)|equation|formula)/.test(lowered)) {
    return 'problem';
  }
  if (/(essay|paper|reflection|analy[sz]e|discuss|describe|explain)/.test(lowered)) {
    return 'essay';
  }
  return 'question';
}

function rewritePhrase(text: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bdiscuss\b/gi, 'explore'],
    [/\banalyze\b/gi, 'examine'],
    [/\banalyse\b/gi, 'examine'],
    [/\bexplain\b/gi, 'clarify'],
    [/\bdescribe\b/gi, 'outline'],
    [/\bcompare\b/gi, 'contrast'],
    [/\bsummarise\b/gi, 'summarise'],
    [/\bsummarize\b/gi, 'summarise'],
    [/\bidentify\b/gi, 'highlight'],
    [/\bdiscussed\b/gi, 'explored']
  ];
  let updated = text;
  for (const [pattern, replacement] of replacements) {
    updated = updated.replace(pattern, replacement);
  }
  return updated;
}

function deriveTopic(prompt: string) {
  const words = prompt
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length > 3)
    .slice(0, 8);
  if (!words.length) {
    return 'the assignment focus';
  }
  const primary = words.slice(0, 3).join(' ');
  return primary.length ? primary : 'the assignment focus';
}

function craftAnswerBody(section: SubmissionSection, depth = 0) {
  const basePrompt = rewritePhrase(normalisePrompt(section.prompt));
  const topic = deriveTopic(basePrompt);
  const sentences: string[] = [];
  if (section.kind === 'essay') {
    sentences.push(`I introduce ${topic} with context drawn from the provided materials.`);
    sentences.push(`I examine the core ideas and relate them to course themes in my own words.`);
    sentences.push(`I close by reflecting on why ${topic} matters for my learning.`);
  } else if (section.kind === 'problem') {
    sentences.push('Step 1: Identify the known values and conditions described.');
    sentences.push('Step 2: Apply the appropriate process carefully, showing the reasoning.');
    sentences.push('Step 3: Verify the outcome against the requirements before finalising it.');
  } else {
    if (/\b(list|identify|name|provide|outline)\b/i.test(basePrompt)) {
      sentences.push(`• Key point one relating to ${topic}.`);
      sentences.push(`• Key point two that reinforces the understanding of ${topic}.`);
      sentences.push(`• Key point three connecting ${topic} back to class discussions.`);
    } else {
      sentences.push(`I respond directly to ${topic} using concise, confident language.`);
      sentences.push(`I connect evidence from the materials to support the response without repeating the prompt verbatim.`);
    }
  }

  if (depth > 0 && sentences[0]) {
    sentences[0] = `I address ${topic} specifically for this part.`;
  }

  let finalAnswer: string | null = null;
  if (section.kind === 'problem') {
    finalAnswer = `Final Answer: ${rewritePhrase(`The requirements for ${topic} are satisfied with clear working shown.`)}`;
  }

  return { sentences, finalAnswer };
}

function parseSubparts(body: string, parentId: string) {
  const subparts: SubmissionSection[] = [];
  const lines = body.split(/\n/);
  let current: SubmissionSection | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.length) {
      continue;
    }
    const match = line.match(/^([a-z]|[ivx]+)[\.)]\s+(.*)$/i);
    if (match) {
      if (current) {
        subparts.push(current);
      }
      current = {
        id: `${parentId}-${match[1].toLowerCase()}`,
        label: match[1].includes('.') ? match[1] : `${match[1]})`,
        prompt: match[2],
        kind: classifySection(match[2]),
        subparts: []
      };
      continue;
    }
    if (current) {
      current.prompt = `${current.prompt} ${line}`.trim();
    }
  }
  if (current) {
    subparts.push(current);
  }
  return subparts;
}

function extractSections(options: BuildSubmissionOptions): SubmissionSection[] {
  const fragments = gatherTextFragments(options);
  if (!fragments.length) {
    return [];
  }
  const combined = cleanWhitespace(fragments.join('\n\n'));
  const lines = combined.split(/\n/);
  const sections: SubmissionSection[] = [];
  let current: SubmissionSection | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!current) {
      return;
    }
    const prompt = buffer.join(' ').trim();
    current.prompt = prompt.length ? prompt : current.prompt;
    current.subparts = parseSubparts(prompt, current.id);
    sections.push(current);
    current = null;
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.length) {
      if (current) {
        buffer.push('');
      }
      continue;
    }
    const match = line.match(/^(\d+)[\.)]\s+(.*)$/);
    if (match) {
      flush();
      current = {
        id: match[1],
        label: `${match[1]}.`,
        prompt: match[2],
        kind: classifySection(match[2]),
        subparts: []
      };
      buffer = [match[2]];
      continue;
    }
    if (!current) {
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (!sections.length) {
    const fallbackPrompt = combined.split(/\n\n/).map((part) => part.trim()).filter(Boolean)[0] ?? 'Respond to the assignment.';
    return [
      {
        id: '1',
        label: '1.',
        prompt: fallbackPrompt,
        kind: classifySection(fallbackPrompt),
        subparts: []
      }
    ];
  }

  return sections;
}

function buildReferences(options: BuildSubmissionOptions, citationStyle: string) {
  const references: string[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const seen = new Set<string>();

  for (const context of options.contexts) {
    const baseName = context.fileName.replace(/\.[^.]+$/, '');
    const title = baseName.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!title.length) {
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (citationStyle === 'MLA 9') {
      references.push(`${title}. ${year}. Manuscript.`);
    } else if (citationStyle === 'Chicago') {
      references.push(`${title}. ${year}. Unpublished class material.`);
    } else {
      references.push(`${title}. (${year}). Unpublished course material.`);
    }
  }

  if (!references.length) {
    references.push('[SOURCE NEEDED]');
  }
  return references;
}

function buildResources(options: BuildSubmissionOptions) {
  const resources: string[] = [];
  if (options.canvasLink) {
    resources.push(`Canvas assignment: ${options.canvasLink}`);
  }
  for (const attachment of options.attachmentLinks ?? []) {
    resources.push(`Attachment: ${attachment.name} – ${attachment.url}`);
  }
  return resources;
}

export function buildSubmissionDraft(options: BuildSubmissionOptions): SubmissionDraft {
  const formatting = detectFormattingPreferences(options);
  const citationStyle = detectCitationStyle(options);
  const sections = extractSections(options);
  const truncated = sections.length > MAX_SECTIONS_FREE;
  const renderable = truncated ? sections.slice(0, MAX_SECTIONS_FREE) : sections;

  const lines: string[] = [];

  if (formatting.includeHeader) {
    lines.push('Name: ____________________');
    lines.push(`Course: ${options.courseName ?? '____________________'}`);
    lines.push('Instructor: ____________________');
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push('');
  }

  const title = options.assignment?.name?.trim().length
    ? options.assignment.name.trim()
    : 'Completed Assignment';
  lines.push(title);
  if (options.dueText) {
    lines.push(`Due: ${options.dueText}`);
  }
  lines.push('');

  renderable.forEach((section, index) => {
    lines.push(`${section.label} ${normalisePrompt(section.prompt)}`);
    const answer = craftAnswerBody(section);
    for (const sentence of answer.sentences) {
      lines.push(sentence);
    }
    for (const sub of section.subparts) {
      lines.push(`  ${sub.label} ${normalisePrompt(sub.prompt)}`);
      const subAnswer = craftAnswerBody(sub, 1);
      for (const sentence of subAnswer.sentences) {
        lines.push(`    ${sentence}`);
      }
      if (subAnswer.finalAnswer) {
        lines.push(`    ${subAnswer.finalAnswer}`);
      }
      lines.push('');
    }
    if (answer.finalAnswer) {
      lines.push(answer.finalAnswer);
    }
    lines.push('');
  });

  lines.push('References');
  const references = buildReferences(options, citationStyle);
  for (const reference of references) {
    lines.push(reference);
  }
  lines.push('');

  const resources = buildResources(options);
  if (resources.length) {
    lines.push('Resources');
    for (const resource of resources) {
      lines.push(resource);
    }
    lines.push('');
  }

  const content = lines.join('\n');

  return {
    content,
    formatting,
    citationStyle,
    references,
    missingSources: references.some((reference) => reference.includes('[SOURCE NEEDED]')),
    truncated,
    sectionCount: { rendered: renderable.length, total: sections.length }
  };
}
