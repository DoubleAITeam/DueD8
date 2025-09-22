import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import AiTokenBadge from '../components/ui/AiTokenBadge';
import { useAiUsageStore, estimateTokensFromText, estimateTokensFromTexts } from '../state/aiUsage';

type DocumentCategory = 'draft' | 'rubric' | 'instructions' | 'notes' | 'research' | 'other';

type ParsedFile = {
  id: string;
  fileName: string;
  content: string;
  wordCount: number;
  category: DocumentCategory;
  uploadedAt: number;
  mimeType: string;
  warnings: string[];
};

type SuggestionCategory = 'structure' | 'clarity' | 'grammar' | 'rubric' | 'insight';

type SuggestionSeverity = 'info' | 'warning' | 'critical';

type Suggestion = {
  id: string;
  title: string;
  detail: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  relatedFiles?: string[];
};

type RubricHighlight = {
  criterion: string;
  status: 'gap' | 'partial' | 'covered';
  missingKeywords: string[];
};

type AnalysisResult = {
  summary: string;
  suggestions: Suggestion[];
  rubricHighlights: RubricHighlight[];
  draftTotals: {
    wordCount: number;
    paragraphCount: number;
    sentenceCount: number;
  } | null;
};

type AssignmentRecord = {
  id: string;
  title: string;
  files: ParsedFile[];
  selectedFileId: string | null;
  createdAt: number;
  analysis: AnalysisResult | null;
  lastAnalyzedAt: number | null;
};

type Feedback = { type: 'info' | 'success' | 'error'; message: string } | null;

type KeywordAnalysis = {
  line: string;
  keywords: string[];
};

type DraftInsight = {
  fileId: string;
  paragraphs: string[];
  sentences: string[];
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'from',
  'have',
  'will',
  'would',
  'could',
  'should',
  'might',
  'about',
  'after',
  'before',
  'because',
  'into',
  'through',
  'which',
  'their',
  'there',
  'these',
  'those',
  'been',
  'being',
  'were',
  'where',
  'your',
  'yours',
  'they',
  'them',
  'than',
  'when',
  'then',
  'such',
  'while'
]);

let pdfWorkerConfigured = false;

function createId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function splitParagraphs(content: string): string[] {
  return normaliseWhitespace(content)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(content: string): string[] {
  return normaliseWhitespace(content)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function detectCategory(fileName: string, content: string): DocumentCategory {
  const lowerName = fileName.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (/rubric|criteria|grading|assessment|score/.test(lowerName) || /rubric|criteria|scoring|points|exceeds|meets/.test(lowerContent)) {
    return 'rubric';
  }

  if (/draft|essay|paper|thesis|manuscript/.test(lowerName) || /introduction|thesis|conclusion|paragraph/.test(lowerContent)) {
    return 'draft';
  }

  if (/instruction|guideline|prompt|assignment/.test(lowerName) || /submit|deadline|instructions|overview/.test(lowerContent)) {
    return 'instructions';
  }

  if (/notes|research|sources|references/.test(lowerName) || /source|evidence|reference|study/.test(lowerContent)) {
    return 'research';
  }

  if (/outline|brainstorm|ideas|mindmap/.test(lowerName) || /outline|bullet|idea/.test(lowerContent)) {
    return 'notes';
  }

  return 'other';
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfModule = await import('pdfjs-dist/build/pdf');
  if (!pdfWorkerConfigured) {
    const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    const workerUrl = (workerSrc as { default: string }).default;
    pdfModule.GlobalWorkerOptions.workerSrc = workerUrl;
    pdfWorkerConfigured = true;
  }

  const loadingTask = pdfModule.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let text = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    text += `${pageText}\n`;
  }

  return text.trim();
}

async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) {
    return '';
  }
  const xmlText = await documentEntry.async('string');
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const paragraphs = Array.from(xml.getElementsByTagName('w:p'));

  const lines = paragraphs.map((paragraph) => {
    const texts = Array.from(paragraph.getElementsByTagName('w:t'));
    return texts.map((textNode) => textNode.textContent ?? '').join('');
  });

  return lines.join('\n').trim();
}

async function parseFileContent(file: File): Promise<{ content: string; warnings: string[] }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type;
  const warnings: string[] = [];

  if (mime.startsWith('text/') || (extension && ['md', 'txt', 'csv', 'json', 'html'].includes(extension))) {
    const text = await file.text();
    return { content: text, warnings };
  }

  if (extension === 'pdf') {
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromPdf(buffer);
      if (!text) {
        warnings.push('Preview is limited because we could not extract readable text from the PDF.');
      }
      return { content: text || '[No extractable text found]', warnings };
    } catch (error) {
      warnings.push('Could not parse PDF contents.');
      return { content: '', warnings };
    }
  }

  if (extension === 'docx') {
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromDocx(buffer);
      if (!text) {
        warnings.push('Preview is limited because this document has no readable text sections.');
      }
      return { content: text || '[Document did not contain readable text]', warnings };
    } catch (error) {
      warnings.push('Could not parse DOCX contents.');
      return { content: '', warnings };
    }
  }

  warnings.push('Unsupported file type. The contents may not display correctly.');
  const fallbackText = await file.text().catch(() => '');
  return { content: fallbackText, warnings };
}

function extractKeywords(line: string): string[] {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function analyseRubricContent(content: string): KeywordAnalysis[] {
  const lines = normaliseWhitespace(content)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /[a-z]/i.test(line));

  return lines.map((line) => ({
    line,
    keywords: extractKeywords(line)
  }));
}

function gatherDraftInsights(draft: ParsedFile): DraftInsight {
  const paragraphs = splitParagraphs(draft.content);
  const sentences = splitSentences(draft.content);
  return {
    fileId: draft.id,
    paragraphs,
    sentences
  };
}

function detectThesis(paragraphs: string[]): boolean {
  if (!paragraphs.length) return false;
  const firstSegment = paragraphs.slice(0, 2).join(' ').toLowerCase();
  return /should|must|argues|argue|because|therefore|this essay|this paper|in this/.test(firstSegment);
}

function detectTransitions(content: string): number {
  const matches = content.match(/\b(furthermore|moreover|however|additionally|consequently|in contrast|meanwhile|on the other hand)\b/gi);
  return matches ? matches.length : 0;
}

function detectCitations(content: string): number {
  const inTextPattern = /\([^)]+\d{4}[^)]*\)/g;
  const urlPattern = /(https?:\/\/[^\s)]+)/g;
  const tally = (content.match(inTextPattern)?.length ?? 0) + (content.match(urlPattern)?.length ?? 0);
  return tally;
}

function pushSuggestion(list: Suggestion[], suggestion: Omit<Suggestion, 'id'>) {
  list.push({ ...suggestion, id: createId('suggestion') });
}

function summariseAnalysis(result: AnalysisResult | null): string {
  if (!result) return 'Upload files to generate context-aware suggestions.';
  if (!result.draftTotals) {
    return 'No drafts detected yet. Add a draft document so the AI can provide writing feedback.';
  }
  const gaps = result.rubricHighlights.filter((item) => item.status !== 'covered').length;
  const suggestions = result.suggestions.length;
  return `Analysed ${result.draftTotals.wordCount} words across drafts. ${gaps ? `${gaps} rubric item${gaps === 1 ? '' : 's'} need attention.` : 'Drafts appear aligned with the rubric.'} ${suggestions ? `Generated ${suggestions} focused suggestion${suggestions === 1 ? '' : 's'}.` : 'No immediate issues detected.'}`;
}

function analyseAssignment(assignment: AssignmentRecord): AnalysisResult {
  const drafts = assignment.files.filter((file) => file.category === 'draft');
  const rubrics = assignment.files.filter((file) => file.category === 'rubric');
  const instructions = assignment.files.filter((file) => file.category === 'instructions');
  const research = assignment.files.filter((file) => file.category === 'research');

  const suggestions: Suggestion[] = [];
  const rubricHighlights: RubricHighlight[] = [];

  if (!drafts.length) {
    instructions.forEach((instruction) => {
      pushSuggestion(suggestions, {
        category: 'structure',
        severity: 'info',
        title: 'Add a draft for analysis',
        detail: `"${instruction.fileName}" looks like assignment instructions. Upload a draft so we can compare it with these requirements.`,
        relatedFiles: [instruction.id]
      });
    });
    return {
      summary: 'Draft not uploaded yet. Add a draft to receive feedback aligned to your rubric and instructions.',
      suggestions,
      rubricHighlights,
      draftTotals: null
    };
  }

  const draftWordCount = drafts.reduce((total, draft) => total + draft.wordCount, 0);
  const draftParagraphs = drafts.flatMap((draft) => splitParagraphs(draft.content));
  const draftSentences = drafts.flatMap((draft) => splitSentences(draft.content));
  const draftInsights = drafts.map(gatherDraftInsights);
  const combinedDraftText = drafts.map((draft) => draft.content.toLowerCase()).join(' \n ');

  drafts.forEach((draft) => {
    const insights = draftInsights.find((item) => item.fileId === draft.id);
    if (!insights) return;

    if (draft.wordCount < 400) {
      pushSuggestion(suggestions, {
        category: 'structure',
        severity: 'warning',
        title: `Expand your draft "${draft.fileName}"`,
        detail: `This draft currently sits at ${draft.wordCount} words. Most essays benefit from more developed analysis and evidence. Aim to add depth to each body paragraph.`,
        relatedFiles: [draft.id]
      });
    }

    if (draft.wordCount > 1800) {
      pushSuggestion(suggestions, {
        category: 'clarity',
        severity: 'info',
        title: `Tighten sections in "${draft.fileName}"`,
        detail: `At ${draft.wordCount} words the draft may drift from the prompt. Review supporting paragraphs and trim repeated ideas to stay concise.`,
        relatedFiles: [draft.id]
      });
    }

    if (!detectThesis(insights.paragraphs)) {
      pushSuggestion(suggestions, {
        category: 'structure',
        severity: 'critical',
        title: 'Clarify or reposition your thesis',
        detail: 'The introduction does not clearly signal a thesis statement. Add a guiding sentence that previews your main argument and the reasoning you will use.',
        relatedFiles: [draft.id]
      });
    }

    const transitionCount = detectTransitions(draft.content);
    if (transitionCount < Math.max(2, insights.paragraphs.length - 1)) {
      pushSuggestion(suggestions, {
        category: 'clarity',
        severity: 'warning',
        title: 'Reinforce transitions between paragraphs',
        detail: 'Consider adding clearer transition phrases (e.g., "Furthermore", "In contrast", "As a result") so each paragraph connects back to your thesis.',
        relatedFiles: [draft.id]
      });
    }

    const longSentences = insights.sentences.filter((sentence) => sentence.split(/\s+/).length > 35);
    if (longSentences.length) {
      pushSuggestion(suggestions, {
        category: 'grammar',
        severity: 'info',
        title: 'Break up very long sentences',
        detail: `Found ${longSentences.length} sentence${longSentences.length === 1 ? '' : 's'} exceeding 35 words. Shorter sentences improve readability and keep ideas focused.`,
        relatedFiles: [draft.id]
      });
    }

    const fillerWords = (draft.content.match(/\b(really|very|just|quite|maybe|perhaps|kind of|sort of)\b/gi) || []).length;
    if (fillerWords > Math.max(6, draft.wordCount / 200)) {
      pushSuggestion(suggestions, {
        category: 'clarity',
        severity: 'info',
        title: 'Trim filler wording',
        detail: 'You rely on softeners like "really" or "maybe" quite often. Swap them for precise language to keep arguments confident.',
        relatedFiles: [draft.id]
      });
    }
  });

  const citations = detectCitations(combinedDraftText);
  if (citations < Math.max(1, drafts.length)) {
    pushSuggestion(suggestions, {
      category: 'insight',
      severity: 'warning',
      title: 'Add citations or evidence',
      detail: 'I only spotted a handful of citations. If your rubric expects research integration, incorporate specific evidence and cite your sources.',
      relatedFiles: drafts.map((draft) => draft.id)
    });
  }

  rubrics.forEach((rubric) => {
    const analyses = analyseRubricContent(rubric.content);
    analyses.forEach((analysis) => {
      if (!analysis.keywords.length) return;
      const presentKeywords = analysis.keywords.filter((keyword) => combinedDraftText.includes(keyword));
      const missingKeywords = analysis.keywords.filter((keyword) => !combinedDraftText.includes(keyword));

      if (!presentKeywords.length) {
        rubricHighlights.push({
          criterion: analysis.line,
          status: 'gap',
          missingKeywords
        });
        pushSuggestion(suggestions, {
          category: 'rubric',
          severity: 'critical',
          title: 'Address a rubric criterion',
          detail: `The rubric item "${analysis.line}" is not reflected in your draft. Focus on bringing in ideas linked to ${missingKeywords.slice(0, 3).join(', ')}.`,
          relatedFiles: drafts.map((draft) => draft.id)
        });
      } else if (missingKeywords.length >= presentKeywords.length) {
        rubricHighlights.push({
          criterion: analysis.line,
          status: 'partial',
          missingKeywords
        });
        pushSuggestion(suggestions, {
          category: 'rubric',
          severity: 'warning',
          title: 'Strengthen alignment with rubric',
          detail: `You touch on "${analysis.line}" but could elaborate on ${missingKeywords.slice(0, 3).join(', ')} to fully meet expectations.`,
          relatedFiles: drafts.map((draft) => draft.id)
        });
      } else {
        rubricHighlights.push({
          criterion: analysis.line,
          status: 'covered',
          missingKeywords: []
        });
      }
    });
  });

  instructions.forEach((instruction) => {
    if (/thesis/i.test(instruction.content) && !detectThesis(draftParagraphs)) {
      pushSuggestion(suggestions, {
        category: 'structure',
        severity: 'warning',
        title: 'Explicitly match the prompt requirement for a thesis',
        detail: 'The instructions emphasise a clear thesis statement. Revisit the introduction to ensure it names your claim and preview your reasoning.',
        relatedFiles: drafts.map((draft) => draft.id).concat(instruction.id)
      });
    }

    if (/sources?|citations?/i.test(instruction.content) && citations < 3) {
      pushSuggestion(suggestions, {
        category: 'insight',
        severity: 'warning',
        title: 'Bring in more sources',
        detail: `The assignment calls for multiple sources, but I only detected ${citations || 'no'} citation${citations === 1 ? '' : 's'}. Plan evidence for each body paragraph.`,
        relatedFiles: drafts.map((draft) => draft.id).concat(instruction.id)
      });
    }
  });

  research.forEach((note) => {
    if (note.wordCount > 0 && drafts.every((draft) => !draft.content.toLowerCase().includes(note.fileName.split('.')[0].toLowerCase()))) {
      pushSuggestion(suggestions, {
        category: 'insight',
        severity: 'info',
        title: `Integrate relevant research from "${note.fileName}"`,
        detail: 'Consider weaving the strongest points from your research notes into body paragraphs. Summarise a quote or statistic and explain how it advances your thesis.',
        relatedFiles: drafts.map((draft) => draft.id).concat(note.id)
      });
    }
  });

  const summary = summariseAnalysis({
    summary: '',
    suggestions,
    rubricHighlights,
    draftTotals: {
      wordCount: draftWordCount,
      paragraphCount: draftParagraphs.length,
      sentenceCount: draftSentences.length
    }
  });

  return {
    summary,
    suggestions,
    rubricHighlights,
    draftTotals: {
      wordCount: draftWordCount,
      paragraphCount: draftParagraphs.length,
      sentenceCount: draftSentences.length
    }
  };
}

function createAssignment(title: string): AssignmentRecord {
  const id = createId('assignment');
  return {
    id,
    title,
    files: [],
    selectedFileId: null,
    createdAt: Date.now(),
    analysis: null,
    lastAnalyzedAt: null
  };
}

function mergeFiles(existing: ParsedFile[], incoming: ParsedFile[]): ParsedFile[] {
  if (!existing.length) return incoming;
  const seen = new Set(existing.map((file) => `${file.fileName}::${file.content}`));
  const merged = [...existing];
  incoming.forEach((file) => {
    const key = `${file.fileName}::${file.content}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });
  return merged;
}

function formatUploadedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function classifyLabel(category: DocumentCategory): string {
  switch (category) {
    case 'draft':
      return 'Draft';
    case 'rubric':
      return 'Rubric';
    case 'instructions':
      return 'Instructions';
    case 'notes':
      return 'Notes';
    case 'research':
      return 'Research';
    default:
      return 'Document';
  }
}

function AiWriter() {
  const [assignments, setAssignments] = useState<AssignmentRecord[]>(() => [createAssignment('Untitled Assignment 1')]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<Record<string, 'idle' | 'running'>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const registerAiTask = useAiUsageStore((state) => state.registerTask);

  useEffect(() => {
    if (!activeAssignmentId && assignments.length) {
      setActiveAssignmentId(assignments[0].id);
    }
  }, [activeAssignmentId, assignments]);

  const activeAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === activeAssignmentId) ?? null,
    [activeAssignmentId, assignments]
  );

  const activeFile = useMemo(() => {
    if (!activeAssignment || !activeAssignment.selectedFileId) return null;
    return activeAssignment.files.find((file) => file.id === activeAssignment.selectedFileId) ?? null;
  }, [activeAssignment]);

  const analysisSummary = useMemo(() => {
    if (activeAssignment?.analysis) {
      return activeAssignment.analysis.summary;
    }
    return summariseAnalysis(null);
  }, [activeAssignment]);

  const analysisEstimate = useMemo(() => {
    if (!activeAssignment || !activeAssignment.files.length) {
      return null;
    }
    const inputTokens = activeAssignment.files.reduce(
      (sum, file) => sum + estimateTokensFromText(file.content),
      0
    );
    let outputTokens = 0;
    if (activeAssignment.analysis) {
      outputTokens = estimateTokensFromTexts([
        activeAssignment.analysis.summary,
        ...activeAssignment.analysis.suggestions.map((suggestion) => `${suggestion.title}\n${suggestion.detail}`)
      ]);
    } else {
      outputTokens = Math.max(320, Math.round(inputTokens * 0.45));
    }
    return {
      total: inputTokens + outputTokens,
      inputTokens,
      outputTokens
    };
  }, [activeAssignment]);

  const parseEstimate = useMemo(() => {
    if (!activeAssignment || !activeAssignment.files.length) {
      return null;
    }
    return activeAssignment.files.reduce(
      (sum, file) => sum + estimateTokensFromText(file.content),
      0
    );
  }, [activeAssignment]);

  const handleCreateAssignment = useCallback(() => {
    const nextIndex = assignments.length + 1;
    const newAssignment = createAssignment(`Untitled Assignment ${nextIndex}`);
    setAssignments((prev) => [...prev, newAssignment]);
    setActiveAssignmentId(newAssignment.id);
  }, [assignments.length]);

  const handleRenameAssignment = useCallback((assignmentId: string, title: string) => {
    setAssignments((prev) =>
      prev.map((assignment) => (assignment.id === assignmentId ? { ...assignment, title } : assignment))
    );
  }, []);

  const handleSelectAssignment = useCallback((assignmentId: string) => {
    setActiveAssignmentId(assignmentId);
  }, []);

  const handleDeleteAssignment = useCallback((assignmentId: string) => {
    const target = assignments.find((assignment) => assignment.id === assignmentId);
    const displayName = target?.title.trim() ? `"${target.title.trim()}"` : 'this assignment';
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${displayName} and all of its uploaded files? This action cannot be undone.`
    );
    if (!confirmed) return;

    const remaining = assignments.filter((assignment) => assignment.id !== assignmentId);
    setAssignments(remaining);
    setAnalysisStatus((prev) => {
      if (!(assignmentId in prev)) return prev;
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    setActiveAssignmentId((prev) => {
      if (!remaining.length) {
        return '';
      }
      if (prev && prev !== assignmentId && remaining.some((assignment) => assignment.id === prev)) {
        return prev;
      }
      return remaining[0].id;
    });
    setFeedback({
      type: 'info',
      message: target?.title.trim() ? `Deleted "${target.title.trim()}".` : 'Assignment deleted.'
    });
  }, [assignments]);

  const runAnalysis = useCallback(
    (assignmentId: string) => {
      const targetAssignment = assignments.find((assignment) => assignment.id === assignmentId);
      if (!targetAssignment) {
        return;
      }

      setAnalysisStatus((prev) => ({ ...prev, [assignmentId]: 'running' }));
      setTimeout(() => {
        const analysis = analyseAssignment(targetAssignment);
        setAssignments((prev) =>
          prev.map((assignment) =>
            assignment.id === assignmentId
              ? {
                  ...assignment,
                  analysis,
                  lastAnalyzedAt: Date.now()
                }
              : assignment
          )
        );

        const inputTokens = targetAssignment.files.reduce(
          (sum, file) => sum + estimateTokensFromText(file.content),
          0
        );
        const suggestionTokens = estimateTokensFromTexts([
          analysis.summary,
          ...analysis.suggestions.map((suggestion) => `${suggestion.title}\n${suggestion.detail}`),
          ...analysis.rubricHighlights.map((highlight) => highlight.criterion)
        ]);
        registerAiTask({
          label: `Analyse ${targetAssignment.title}`,
          category: 'analyze',
          steps: [
            { label: 'Review uploaded docs', tokenEstimate: inputTokens },
            { label: 'Draft suggestions', tokenEstimate: suggestionTokens }
          ],
          metadata: {
            assignmentId,
            fileCount: targetAssignment.files.length,
            suggestionCount: analysis.suggestions.length
          }
        });

        setAnalysisStatus((prev) => ({ ...prev, [assignmentId]: 'idle' }));
        setFeedback({ type: 'success', message: 'Suggestions updated.' });
      }, 60);
    },
    [assignments, registerAiTask]
  );

  const handleUpload = useCallback(
    async (assignmentId: string, fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const files = Array.from(fileList);
      const assignmentRecord = assignments.find((item) => item.id === assignmentId);
      setFeedback(null);
      setAnalysisStatus((prev) => ({ ...prev, [assignmentId]: 'running' }));

      try {
        const parsed = await Promise.all(
          files.map(async (file) => {
            const result = await parseFileContent(file);
            const category = detectCategory(file.name, result.content);
            return {
              id: createId('file'),
              fileName: file.name,
              content: normaliseWhitespace(result.content),
              wordCount: countWords(result.content),
              category,
              uploadedAt: Date.now(),
              mimeType: file.type,
              warnings: result.warnings
            } satisfies ParsedFile;
          })
        );

        setAssignments((prev) =>
          prev.map((assignment) => {
            if (assignment.id !== assignmentId) return assignment;
            const mergedFiles = mergeFiles(assignment.files, parsed);
            const hasSelection = mergedFiles.some((file) => file.id === assignment.selectedFileId);
            const nextSelectedFileId = hasSelection
              ? assignment.selectedFileId
              : mergedFiles[mergedFiles.length - 1]?.id ?? null;
            const updated: AssignmentRecord = {
              ...assignment,
              files: mergedFiles,
              selectedFileId: nextSelectedFileId
            };
            updated.analysis = mergedFiles.length ? analyseAssignment(updated) : null;
            updated.lastAnalyzedAt = mergedFiles.length ? Date.now() : assignment.lastAnalyzedAt;
            return updated;
          })
        );

        const extractionTokens = parsed.reduce(
          (sum, file) => sum + estimateTokensFromText(file.content),
          0
        );
        const metadataTokens = parsed.length * 60;
        registerAiTask({
          label: `Parse ${parsed.length} document${parsed.length === 1 ? '' : 's'} for ${assignmentRecord?.title ?? 'assignment'}`,
          category: 'parse',
          steps: [
            { label: 'Extract text', tokenEstimate: extractionTokens },
            { label: 'Categorise content', tokenEstimate: metadataTokens }
          ],
          metadata: {
            assignmentId,
            fileNames: parsed.map((file) => file.fileName),
            categories: parsed.map((file) => file.category)
          }
        });

        setFeedback({
          type: 'success',
          message: `Uploaded ${parsed.length} file${parsed.length === 1 ? '' : 's'} successfully.`
        });
      } catch (error) {
        console.error('Failed to parse uploaded files', error);
        setFeedback({ type: 'error', message: 'Could not read one or more files. Try again or upload a different format.' });
      } finally {
        setAnalysisStatus((prev) => ({ ...prev, [assignmentId]: 'idle' }));
      }
    },
    [assignments, registerAiTask]
  );

  const handleSelectFile = useCallback((assignmentId: string, fileId: string) => {
    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, selectedFileId: fileId } : assignment
      )
    );
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!activeAssignment) return;
    runAnalysis(activeAssignment.id);
  }, [activeAssignment, runAnalysis]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const feedbackMessage = useMemo(() => {
    if (!feedback) return null;
    return (
      <div className={`ai-writer__feedback ai-writer__feedback--${feedback.type}`}>
        {feedback.message}
      </div>
    );
  }, [feedback]);

  return (
    <AppShell pageTitle="AI Writer">
      <div className="ai-writer">
        <aside className="ai-writer__sidebar">
          <div className="ai-writer__sidebar-header">
            <h2>Assignments</h2>
            <button type="button" onClick={handleCreateAssignment} className="ai-writer__sidebar-create">
              + New
            </button>
          </div>
          <div className="ai-writer__sidebar-list" role="tablist" aria-label="AI writer assignments">
            {assignments.map((assignment) => {
              const isActive = assignment.id === activeAssignmentId;
              const fileCount = assignment.files.length;
              return (
                <div
                  key={assignment.id}
                  className={`ai-writer__sidebar-item${isActive ? ' ai-writer__sidebar-item--active' : ''}`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className="ai-writer__sidebar-item-trigger"
                    onClick={() => handleSelectAssignment(assignment.id)}
                  >
                    <span className="ai-writer__sidebar-item-title">{assignment.title}</span>
                    <span className="ai-writer__sidebar-item-meta">
                      {fileCount ? `${fileCount} file${fileCount === 1 ? '' : 's'}` : 'No files yet'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ai-writer__sidebar-delete"
                    aria-label={`Delete ${assignment.title.trim() ? assignment.title : 'assignment'}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      handleDeleteAssignment(assignment.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="ai-writer__workspace">
          {activeAssignment ? (
            <>
              <div className="ai-writer__workspace-header">
                <div className="ai-writer__title-group">
                  <label className="ai-writer__title-label" htmlFor="ai-writer-title">
                    Assignment title
                  </label>
                  <input
                    id="ai-writer-title"
                    className="ai-writer__title-input"
                    value={activeAssignment.title}
                    onChange={(event) => handleRenameAssignment(activeAssignment.id, event.target.value)}
                    placeholder="Untitled assignment"
                  />
                </div>
                <div className="ai-writer__controls">
                  <label className="ai-writer__upload">
                    <input
                      type="file"
                      multiple
                      onChange={(event) => {
                        handleUpload(activeAssignment.id, event.target.files);
                        event.target.value = '';
                      }}
                    />
                    Upload files
                  </label>
                  {parseEstimate ? <AiTokenBadge category="parse" tokens={parseEstimate} /> : null}
                  <button
                    type="button"
                    className="ai-writer__regenerate"
                    onClick={handleRegenerate}
                    disabled={analysisStatus[activeAssignment.id] === 'running' || !activeAssignment.files.length}
                  >
                    {analysisStatus[activeAssignment.id] === 'running' ? 'Analysing…' : 'Regenerate Suggestions'}
                  </button>
                  {analysisEstimate ? (
                    <AiTokenBadge category="analyze" tokens={analysisEstimate.total} />
                  ) : null}
                </div>
              </div>

              {feedbackMessage}

              <div className="ai-writer__summary">
                {analysisSummary}
              </div>

              <div className="ai-writer__panels">
                <section className="ai-writer__panel ai-writer__panel--files" aria-label="Uploaded material">
                  <header className="ai-writer__panel-header">
                    <h3>Source Material</h3>
                    {analysisStatus[activeAssignment.id] === 'running' ? <span>Processing…</span> : null}
                  </header>

                  {activeAssignment.files.length ? (
                    <>
                      <div className="ai-writer__file-tabs" role="tablist" aria-label="Uploaded files">
                        {activeAssignment.files.map((file) => {
                          const isSelected = file.id === activeAssignment.selectedFileId;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              className={`ai-writer__file-tab${isSelected ? ' ai-writer__file-tab--active' : ''}`}
                              onClick={() => handleSelectFile(activeAssignment.id, file.id)}
                              role="tab"
                              aria-selected={isSelected}
                            >
                              <span className="ai-writer__file-tab-title">{file.fileName}</span>
                              <span className="ai-writer__file-tab-meta">{classifyLabel(file.category)}</span>
                            </button>
                          );
                        })}
                      </div>

                      {activeFile ? (
                        <article className="ai-writer__file-preview" aria-live="polite">
                          <header className="ai-writer__file-meta">
                            <div>
                              <strong>{activeFile.fileName}</strong>
                              <span className="ai-writer__file-meta-type">{classifyLabel(activeFile.category)}</span>
                            </div>
                            <div className="ai-writer__file-meta-detail">
                              Uploaded {formatUploadedAt(activeFile.uploadedAt)}
                            </div>
                            <div className="ai-writer__file-meta-detail ai-writer__file-meta-detail--count" aria-live="polite">
                              Word Count: <strong>{activeFile.wordCount}</strong>
                            </div>
                            {activeFile.warnings.length ? (
                              <ul className="ai-writer__file-warnings">
                                {activeFile.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            ) : null}
                          </header>
                          <div className="ai-writer__file-content">
                            {activeFile.content ? (
                              <pre>{activeFile.content}</pre>
                            ) : (
                              <p>Preview not available for this file type.</p>
                            )}
                          </div>
                        </article>
                      ) : (
                        <div className="ai-writer__empty-panel">
                          <p>Select a document to preview its contents.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ai-writer__empty-panel">
                      <h4>Add your first files</h4>
                      <p>Upload a draft, rubric, or notes to begin receiving AI-powered insights.</p>
                    </div>
                  )}
                </section>

                <section className="ai-writer__panel ai-writer__panel--suggestions" aria-label="AI suggestions">
                  <header className="ai-writer__panel-header">
                    <h3>AI Suggestions</h3>
                    {activeAssignment.lastAnalyzedAt ? (
                      <span className="ai-writer__analysis-timestamp">
                        Updated {formatUploadedAt(activeAssignment.lastAnalyzedAt)}
                      </span>
                    ) : null}
                  </header>

                  {activeAssignment.analysis && activeAssignment.analysis.suggestions.length ? (
                    <ul className="ai-writer__suggestions-list">
                      {activeAssignment.analysis.suggestions.map((suggestion) => (
                        <li key={suggestion.id} className={`ai-writer__suggestion ai-writer__suggestion--${suggestion.severity}`}>
                          <div className="ai-writer__suggestion-header">
                            <span className="ai-writer__suggestion-category">{suggestion.category}</span>
                            <h4>{suggestion.title}</h4>
                          </div>
                          <p>{suggestion.detail}</p>
                          {suggestion.relatedFiles?.length ? (
                            <div className="ai-writer__suggestion-files">Applies to {suggestion.relatedFiles.length} file{suggestion.relatedFiles.length === 1 ? '' : 's'}.</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ai-writer__empty-panel ai-writer__empty-panel--suggestions">
                      <h4>No suggestions yet</h4>
                      {activeAssignment.files.length ? (
                        <p>Nice work—nothing urgent found. Regenerate suggestions after you revise the draft.</p>
                      ) : (
                        <p>Upload a draft and supporting documents to see tailored recommendations.</p>
                      )}
                    </div>
                  )}

                  {activeAssignment.analysis && activeAssignment.analysis.rubricHighlights.length ? (
                    <div className="ai-writer__rubric-highlights">
                      <h4>Rubric coverage</h4>
                      <ul>
                        {activeAssignment.analysis.rubricHighlights.map((highlight, index) => (
                          <li key={`${highlight.criterion}-${index}`} className={`ai-writer__rubric-item ai-writer__rubric-item--${highlight.status}`}>
                            <span className="ai-writer__rubric-status">{highlight.status}</span>
                            <span className="ai-writer__rubric-text">{highlight.criterion}</span>
                            {highlight.missingKeywords.length ? (
                              <span className="ai-writer__rubric-keywords">
                                Missing: {highlight.missingKeywords.slice(0, 5).join(', ')}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          ) : (
            <div className="ai-writer__empty-panel">
              <h4>Create an assignment</h4>
              <p>Select an assignment from the sidebar or create a new one to begin.</p>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}

export default AiWriter;
