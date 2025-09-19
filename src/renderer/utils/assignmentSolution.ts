export type TokenLimitResult = {
  content: string;
  tokensUsed: number;
  truncated: boolean;
  remainingTokens: number;
  totalTokens: number;
};

function splitSegments(content: string) {
  return content
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isOrderedListLine(line: string) {
  return /^\s*\d+\.\s+/.test(line);
}

function isUnorderedListLine(line: string) {
  return /^\s*[-•]\s+/.test(line);
}

function renderList(lines: string[], ordered: boolean) {
  const tag = ordered ? 'ol' : 'ul';
  const normalised = lines.map((line) =>
    ordered ? line.replace(/^\s*\d+\.\s+/, '') : line.replace(/^\s*[-•]\s+/, '')
  );
  const items = normalised
    .map((line) => `<li>${escapeHtml(line.trim())}</li>`)
    .join('');
  return `<${tag}>${items}</${tag}>`;
}

function renderParagraphs(lines: string[]) {
  return lines
    .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
    .join('');
}

export function renderSolutionHtml(content: string): string {
  const segments = splitSegments(content);
  if (!segments.length) {
    return '<article class="solution-document"><p>No content generated.</p></article>';
  }

  const [headerSegment, ...restSegments] = segments;
  const headerLines = headerSegment.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = headerLines.shift() ?? 'Completed Submission';
  const headerHtml: string[] = [];
  headerHtml.push(`<h1>${escapeHtml(title)}</h1>`);
  if (headerLines.length) {
    headerHtml.push(
      `<div class="metadata">${headerLines
        .map((line) => `<span>${escapeHtml(line)}</span>`)
        .join('')}</div>`
    );
  }

  const bodyHtml: string[] = [];
  restSegments.forEach((segment) => {
    const lines = segment.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      return;
    }
    const firstLine = lines[0];
    if (/[^:]+:$/.test(firstLine)) {
      const heading = firstLine.replace(/:$/, '').trim();
      const remainder = lines.slice(1);
      if (!remainder.length) {
        bodyHtml.push(`<section><h2>${escapeHtml(heading)}</h2></section>`);
        return;
      }
      const ordered = remainder.every(isOrderedListLine);
      const unordered = remainder.every((line) => isUnorderedListLine(line) || isOrderedListLine(line));
      const listHtml = ordered
        ? renderList(remainder, true)
        : unordered
          ? renderList(remainder, false)
          : renderParagraphs(remainder);
      bodyHtml.push(`<section><h2>${escapeHtml(heading)}</h2>${listHtml}</section>`);
      return;
    }

    const ordered = lines.every(isOrderedListLine);
    const unordered = lines.every((line) => isUnorderedListLine(line) || isOrderedListLine(line));
    if (ordered || unordered) {
      bodyHtml.push(`<section>${renderList(lines, ordered)}</section>`);
    } else {
      bodyHtml.push(`<section>${renderParagraphs(lines)}</section>`);
    }
  });

  return `<article class="solution-document"><header>${headerHtml.join('')}</header>${bodyHtml.join('')}</article>`;
}

function splitIntoSentences(content: string): string[] {
  const sentences: string[] = [];
  const regex = /[^.!?]+[.!?]*(?:\s+|$)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(content)) !== null) {
    if (!match[0].length) {
      break;
    }
    sentences.push(match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    sentences.push(content.slice(lastIndex));
  }
  return sentences.length ? sentences : [content];
}

export function estimateTokenCount(content: string): number {
  const words = content
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return 0;
  }
  return Math.ceil(words.length * 1.2);
}

function estimateSentenceTokens(sentence: string) {
  return Math.max(estimateTokenCount(sentence), sentence.trim().length ? 1 : 0);
}

export function applyTokenLimit(
  content: string,
  availableTokens: number,
  graceTokens: number
): TokenLimitResult {
  const totalTokens = estimateTokenCount(content);
  const sentences = splitIntoSentences(content);
  if (!sentences.length) {
    return { content: '', tokensUsed: 0, truncated: false, remainingTokens: 0, totalTokens: 0 };
  }

  const limit = Math.max(availableTokens, 0);
  const maxWithGrace = limit + Math.max(graceTokens, 0);
  const selected: string[] = [];
  let used = 0;

  for (const sentence of sentences) {
    const tokens = estimateSentenceTokens(sentence);
    if (used + tokens <= limit) {
      selected.push(sentence);
      used += tokens;
      continue;
    }

    const wouldExceed = used + tokens;
    if ((selected.length === 0 && tokens <= maxWithGrace) || (used < limit && wouldExceed <= maxWithGrace)) {
      selected.push(sentence);
      used += tokens;
    }
    break;
  }

  const truncated = selected.length < sentences.length;
  const finalContent = truncated ? selected.join('').trimEnd() : content;
  const remainingTokens = Math.max(totalTokens - used, 0);
  return { content: finalContent, tokensUsed: used, truncated, remainingTokens, totalTokens };
}

export function buildSolutionContent(options: {
  assignmentName?: string | null;
  courseName?: string;
  dueText?: string;
  contexts: Array<{ fileName: string; content: string }>;
}): string {
  const { assignmentName, courseName, dueText, contexts } = options;
  const title = assignmentName?.trim().length ? assignmentName.trim() : 'Assignment';
  const headerLines: string[] = [`${title} – Completed Submission`];
  if (courseName?.trim().length) {
    headerLines.push(`Course: ${courseName.trim()}`);
  }
  if (dueText?.trim().length) {
    headerLines.push(`Due: ${dueText.trim()}`);
  }

  const intro: string[] = [];
  intro.push(
    'This draft weaves together the provided instructions and supporting documents to deliver a polished response ready for review.'
  );

  const contextSummaries = contexts.slice(0, 4).map((entry, index) => {
    const snippet = entry.content.replace(/\s+/g, ' ').trim();
    const preview = snippet.length > 160 ? `${snippet.slice(0, 160)}…` : snippet;
    return `${index + 1}. ${entry.fileName}: ${preview}`;
  });

  const planningLines: string[] = [];
  planningLines.push('Planning Overview:');
  planningLines.push('- Map each required deliverable to relevant excerpts from the uploaded materials.');
  planningLines.push('- Structure the submission with clear sections (introduction, core evidence, reflective close).');
  planningLines.push('- Cite the most authoritative sources from the context to justify conclusions.');

  const bodySections: string[] = [];
  const anchorContext = contexts[0];
  if (anchorContext) {
    bodySections.push(
      `Introduction: Summarise the overarching goal outlined in “${anchorContext.fileName}” and preview the supporting arguments.`
    );
  } else {
    bodySections.push('Introduction: Present the main thesis and highlight the deliverables covered in this response.');
  }

  contexts.slice(0, 3).forEach((entry, index) => {
    const snippet = entry.content.replace(/\s+/g, ' ').trim();
    const preview = snippet.length > 200 ? `${snippet.slice(0, 200)}…` : snippet;
    bodySections.push(
      `Section ${index + 1}: Incorporate evidence from “${entry.fileName}” to address the rubric. Key takeaway: ${preview}`
    );
  });

  bodySections.push('Conclusion: Reinforce how each rubric item is satisfied and outline any follow-up steps before submission.');

  const reflection: string[] = [];
  reflection.push('Quality Check:');
  reflection.push('- Proofread for clarity, tone, and adherence to submission guidelines.');
  reflection.push('- Ensure citations or references match course expectations.');
  reflection.push('- Confirm formatting and file naming follow instructor preferences.');

  const segments = [
    headerLines.join('\n'),
    intro.join('\n'),
    contextSummaries.length ? ['Supporting Evidence Highlights:', ...contextSummaries].join('\n') : '',
    planningLines.join('\n'),
    ['Draft Blueprint:', ...bodySections].join('\n'),
    reflection.join('\n')
  ].filter(Boolean);

  return segments.join('\n\n');
}
