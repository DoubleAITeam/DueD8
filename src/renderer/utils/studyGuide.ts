import type { AssignmentContextEntry } from '../state/store';

export type GuideSection = {
  id: string;
  title: string;
  body: string;
};

export type StudyGuidePlan = {
  heading: string;
  overview: string;
  sections: GuideSection[];
};

function normaliseSnippet(input: string, length: number) {
  const flattened = input.replace(/\s+/g, ' ').trim();
  if (!flattened.length) {
    return '';
  }
  if (flattened.length <= length) {
    return flattened;
  }
  return `${flattened.slice(0, length).trimEnd()}…`;
}

function buildContextBullets(entries: AssignmentContextEntry[]) {
  if (!entries.length) {
    return ['No uploaded context detected yet. Gather rubrics, notes, or research excerpts before drafting.'];
  }
  return entries.slice(0, 6).map((entry) => {
    const snippet = normaliseSnippet(entry.content, 220);
    return `• **${entry.fileName}** — ${snippet || 'High-level summary unavailable; skim the document for must-have details.'}`;
  });
}

function buildObjectiveBullets(entries: AssignmentContextEntry[], assignmentName?: string | null) {
  const title = assignmentName?.trim() || 'this assignment';
  const bullets: string[] = [];
  bullets.push(`• Clarify what success looks like for **${title}** by re-reading the rubric or checklist.`);
  bullets.push('• Break the submission into milestones: research, outline, draft, review, and polish.');
  if (entries.length) {
    const top = entries[0];
    bullets.push(`• Map each rubric item to evidence inside **${top.fileName}** so you never guess about expectations.`);
  } else {
    bullets.push('• Ask your instructor for grading criteria if expectations are still unclear.');
  }
  bullets.push('• Create a short timeline that reserves buffer time for feedback and proofreading.');
  return bullets;
}

function buildTopicOutline(entries: AssignmentContextEntry[], courseName?: string) {
  const topics: string[] = [];
  const courseLabel = courseName?.trim() || 'the course';
  const baseTopics = entries.slice(0, 4);
  if (baseTopics.length) {
    baseTopics.forEach((entry, index) => {
      const snippet = normaliseSnippet(entry.content, 140);
      topics.push(`- **Topic ${index + 1}:** Anchor your notes in “${entry.fileName}”. ${snippet}`);
    });
  } else {
    topics.push('- **Concept review:** Revisit your lecture notes and highlight definitions or formulas.');
    topics.push('- **Evidence gathering:** Collect two to three credible sources that support your argument.');
    topics.push('- **Structure check:** Plan introduction, body sections, and conclusion with bullet points.');
  }
  topics.push(`- **Course alignment:** Mention how the submission extends learning from ${courseLabel}.`);
  return topics;
}

function buildWorkedExamples(entries: AssignmentContextEntry[]) {
  const examples: string[] = [];
  if (!entries.length) {
    examples.push('1. **Outline build:** List the sections you will cover. Add one supporting idea for each section.');
    examples.push('2. **Evidence match:** Pair each section with a supporting quote or data point.');
    examples.push('3. **Draft paragraph:** Write a short paragraph that answers the main prompt using one of your sources.');
    return examples;
  }
  const primary = entries[0];
  const second = entries[1];
  const third = entries[2];
  examples.push(
    `1. **Extract requirements** from “${primary.fileName}”. Highlight verbs (explain, compare, design) and note deliverables.`
  );
  if (second) {
    examples.push(
      `2. **Map evidence** using “${second.fileName}”. Build a table with rubric rows and supporting quotes or data.`
    );
  } else {
    examples.push('2. **Map evidence**. Draft a simple table with rubric rows and supporting quotes or data.');
  }
  if (third) {
    examples.push(
      `3. **Compose a body paragraph** referencing “${third.fileName}”. Start with a claim, add evidence, and finish with analysis.`
    );
  } else {
    examples.push('3. **Compose a body paragraph.** Start with a claim, add evidence, and finish with analysis.');
  }
  examples.push('4. **Self-review** using a checklist: thesis clarity, evidence alignment, and citation format.');
  return examples;
}

function buildMistakes(entries: AssignmentContextEntry[]) {
  const mistakes: string[] = [];
  mistakes.push('- Ignoring the exact deliverables listed in the assignment header. Re-state them before drafting.');
  mistakes.push('- Waiting to gather sources until the night before. Collect references while outlining.');
  if (entries.length) {
    mistakes.push(`- Skipping the instructor file “${entries[0].fileName}”. It usually hides subtle grading hints.`);
  }
  mistakes.push('- Forgetting to proofread aloud or run a spelling check before submission.');
  return mistakes;
}

function buildQuickChecks(entries: AssignmentContextEntry[], assignmentName?: string | null) {
  const title = assignmentName?.trim() || 'this assignment';
  const questions: Array<{ question: string; answer: string }> = [];
  questions.push({
    question: `What is the primary deliverable for **${title}** and how will you show completion?`,
    answer: entries.length
      ? `Use “${entries[0].fileName}” to restate the deliverable in one sentence and list the submission format (essay, slides, video).`
      : 'Restate the deliverable in one sentence and note the submission format (essay, slides, video).'
  });
  questions.push({
    question: 'Which sources or notes directly support your thesis?',
    answer: entries.length
      ? `At minimum, cite “${entries[0].fileName}” and one supporting piece such as “${entries[1]?.fileName ?? 'a lecture note or reading'}”.`
      : 'List at least two readings, lectures, or data sources that reinforce your thesis.'
  });
  questions.push({
    question: 'How will you manage your time from now until the due date?',
    answer:
      'Block time for drafting, revision, and a final quality check. Add calendar reminders so each step actually happens.'
  });
  return questions;
}

function buildReferences(entries: AssignmentContextEntry[]) {
  if (!entries.length) {
    return ['No uploaded files referenced yet. Add instructor rubrics or your research notes for richer guidance.'];
  }
  return entries.map((entry) => {
    const snippet = normaliseSnippet(entry.content, 180);
    return `- **${entry.fileName}** — added ${new Date(entry.uploadedAt).toLocaleDateString()}\n  - Notes: ${snippet || 'Review this file for specific page numbers or data to cite.'}`;
  });
}

export function buildStudyGuidePlan(options: {
  assignmentName?: string | null;
  courseName?: string;
  dueAt?: string | null;
  contexts: AssignmentContextEntry[];
}): StudyGuidePlan {
  const { assignmentName, courseName, dueAt, contexts } = options;
  const title = assignmentName?.trim().length ? `${assignmentName.trim()} – Study Coach Guide` : 'Study Coach Assignment Guide';
  const dueDescription = dueAt
    ? `Due ${new Date(dueAt).toLocaleString()}. Build backwards from the deadline so you submit with confidence.`
    : 'No official due date recorded. Set a personal deadline and share it with a study partner for accountability.';
  const overviewChunks: string[] = [];
  overviewChunks.push(dueDescription);
  const contextBullets = buildContextBullets(contexts);
  overviewChunks.push('**Key files in focus:**');
  overviewChunks.push(contextBullets.join('\n'));
  overviewChunks.push(
    'This guide keeps instructions short, friendly, and actionable so you can start drafting without second-guessing next steps.'
  );

  const sections: GuideSection[] = [];
  sections.push({
    id: 'scope-objectives',
    title: 'Scope and Key Objectives',
    body: buildObjectiveBullets(contexts, assignmentName).join('\n')
  });
  sections.push({
    id: 'topics-subtopics',
    title: 'Topics and Subtopics to Cover',
    body: buildTopicOutline(contexts, courseName).join('\n')
  });
  sections.push({
    id: 'worked-examples',
    title: 'Worked Examples with Steps',
    body: buildWorkedExamples(contexts).join('\n')
  });
  sections.push({
    id: 'mistakes-tips',
    title: 'Common Mistakes and Helpful Tips',
    body: buildMistakes(contexts).join('\n')
  });
  const quickCheck = buildQuickChecks(contexts, assignmentName)
    .map(
      (qa, index) =>
        `${index + 1}. **${qa.question}**\n   <details><summary>Show answer</summary>${qa.answer}</details>`
    )
    .join('\n\n');
  sections.push({
    id: 'quick-check',
    title: 'Quick Check Questions',
    body: quickCheck
  });
  sections.push({
    id: 'references',
    title: 'References and Source Notes',
    body: buildReferences(contexts).join('\n')
  });

  return {
    heading: title,
    overview: overviewChunks.join('\n\n'),
    sections
  };
}

export function convertGuideToMarkdown(plan: StudyGuidePlan, uptoSection?: number): string {
  const maxIndex = typeof uptoSection === 'number' ? uptoSection : plan.sections.length - 1;
  const segments: string[] = [`# ${plan.heading}`, plan.overview];
  plan.sections.slice(0, maxIndex + 1).forEach((section) => {
    segments.push(`## ${section.title}`);
    segments.push(section.body);
  });
  return segments.join('\n\n');
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (match) =>
      match
        .replace(/```/g, '')
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')
    )
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
