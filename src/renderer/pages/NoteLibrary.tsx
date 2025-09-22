import React, { useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useRawCourses } from '../state/dashboard';
import {
  GENERAL_NOTE_CLASS_ID,
  useNotesStore,
  type NoteRecord,
  type NoteContentType
} from '../state/notes';
import { useStore } from '../state/store';
import { useNavigate } from '../routes/router';
import { useAiUsageStore, estimateTokensFromText, estimateTokensFromTexts } from '../state/aiUsage';
import AiTokenBadge from '../components/ui/AiTokenBadge';

const INPUT_MODES = [
  {
    id: 'text' as const,
    label: 'Typed text',
    hint: 'Paste notes or write directly to organise them automatically.'
  },
  {
    id: 'image' as const,
    label: 'Image (OCR)',
    hint: 'Upload screenshots or handwritten notes and let OCR extract the text.'
  },
  {
    id: 'audio' as const,
    label: 'Audio (Premium)',
    hint: 'Transcribe lectures and auto-highlight the important pieces.'
  },
  {
    id: 'youtube' as const,
    label: 'YouTube (Premium)',
    hint: 'Paste YouTube links to extract transcriptions and create notes automatically.'
  }
];

type InputMode = (typeof INPUT_MODES)[number]['id'];

type DraftAnalysis = {
  keyTakeaways: string[];
  topics: Array<{ heading: string; detail: string }>;
  numbers: string[];
  rawText?: string;
  transcript?: string;
  suggestedTitle?: string;
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function summariseBlock(block: string): string {
  const sentences = block.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 0) {
    const compact = sentences[0];
    const words = compact.split(/\s+/);
    if (words.length > 16) {
      return `${words.slice(0, 16).join(' ')}…`;
    }
    return compact;
  }

  const words = block.split(/\s+/);
  return words.length > 16 ? `${words.slice(0, 16).join(' ')}…` : block;
}

function deriveTitleFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.trim();
  if (!cleaned) return undefined;
  const words = cleaned.split(/\s+/);
  if (words.length === 0) return undefined;
  const preview = words.slice(0, 7).join(' ');
  return words.length > 7 ? `${preview}…` : preview;
}

function analyseBlocks(blocks: string[], original: string): DraftAnalysis {
  const numbers = new Set<string>();
  const topics: Array<{ heading: string; detail: string }> = [];
  const keyTakeaways: string[] = [];

  blocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    trimmed.replace(/\b\d+(?:[.,]\d+)?\b/g, (match) => {
      numbers.add(match);
      return match;
    });
    trimmed.replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2})(?:,\s*\d{2,4})?/gi,
      (match) => {
        numbers.add(match);
        return match;
      }
    );

    const headingMatch = trimmed.match(/^(.*?)(?:[:–-]|\u2014)\s+(.+)/);
    if (headingMatch) {
      topics.push({ heading: headingMatch[1].trim(), detail: headingMatch[2].trim() });
    } else {
      topics.push({ heading: `Section ${index + 1}`, detail: trimmed });
    }

    if (keyTakeaways.length < 5) {
      keyTakeaways.push(summariseBlock(trimmed));
    }
  });

  const dedupedTakeaways = Array.from(new Set(keyTakeaways));

  return {
    keyTakeaways: dedupedTakeaways,
    topics,
    numbers: Array.from(numbers),
    rawText: original,
    suggestedTitle: deriveTitleFromText(blocks[0])
  };
}

function buildBlocksFromText(input: string): { blocks: string[]; analysis: DraftAnalysis } {
  const normalised = normaliseWhitespace(input).trim();
  if (!normalised) {
    return { blocks: [], analysis: { keyTakeaways: [], topics: [], numbers: [], rawText: '' } };
  }

  const bulletPattern = /(^|\n)\s*(?:[-*•]|\d+\.)\s+/;
  let blocks: string[] = [];

  if (bulletPattern.test(normalised)) {
    blocks = normalised
      .split(/\n?\s*(?:[-*•]|\d+\.)\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  } else {
    blocks = normalised
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (blocks.length === 1) {
      const sentences = normalised.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length > 4) {
        const chunkSize = Math.ceil(sentences.length / 4);
        const chunked: string[] = [];
        for (let index = 0; index < sentences.length; index += chunkSize) {
          chunked.push(sentences.slice(index, index + chunkSize).join(' '));
        }
        blocks = chunked;
      }
    }
  }

  const cleaned = blocks.map((segment) => segment.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const analysis = analyseBlocks(cleaned, normalised);
  return { blocks: cleaned, analysis };
}

async function simulateImageOcr(file: File): Promise<string> {
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' ');
  await new Promise((resolve) => setTimeout(resolve, 450));
  return [
    `Image capture: ${toTitleCase(baseName) || 'Class Notes'}`,
    'Key points detected: formulas, reminders, and follow-up tasks.',
    'AI cleaned handwriting artefacts and grouped related sentences.'
  ].join('\n\n');
}

type SimulatedTranscription = {
  transcript: string;
  segments: Array<{ topic: string; summary: string; marker: string }>;
  keyTakeaways: string[];
  numbers: string[];
};

type YoutubeTranscription = SimulatedTranscription & {
  videoId: string;
  videoTitle: string;
  channelName: string;
  startOffset?: number;
};

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

function parseYoutubeVideoId(rawUrl: string): { videoId: string; startOffset?: number } | null {
  try {
    const url = new URL(rawUrl.trim());
    if (!YOUTUBE_HOSTS.has(url.hostname)) {
      return null;
    }

    let videoId = '';
    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.slice(1);
    } else if (url.pathname.startsWith('/watch')) {
      videoId = url.searchParams.get('v') ?? '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/shorts/')[1]?.split(/[/?#]/)[0] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/embed/')[1]?.split(/[/?#]/)[0] ?? '';
    }

    videoId = videoId.trim();
    if (!videoId) {
      return null;
    }

    const timeParam = url.searchParams.get('t') ?? url.searchParams.get('start') ?? undefined;
    let startOffset: number | undefined;
    if (timeParam) {
      const timeValue = timeParam.toString();
      const hmsMatch = timeValue.match(/^(\d+)?h?(\d+)?m?(\d+)?s?$/i);
      if (hmsMatch) {
        const hours = parseInt(hmsMatch[1] ?? '0', 10);
        const minutes = parseInt(hmsMatch[2] ?? '0', 10);
        const seconds = parseInt(hmsMatch[3] ?? '0', 10);
        startOffset = hours * 3600 + minutes * 60 + seconds;
      } else {
        const numeric = Number.parseInt(timeValue, 10);
        if (!Number.isNaN(numeric) && numeric >= 0) {
          startOffset = numeric;
        }
      }
    }

    return { videoId, startOffset };
  } catch (error) {
    return null;
  }
}

function synthesiseYoutubeTitle(videoId: string): string {
  const cleaned = videoId.replace(/[^a-z0-9]+/gi, ' ').trim();
  if (cleaned.length > 0) {
    const words = cleaned.split(/\s+/).map((word) => word.toLowerCase());
    const unique = Array.from(new Set(words)).slice(0, 5);
    if (unique.length > 0) {
      return `${unique.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ')} Lecture Recap`;
    }
  }
  const fallbacks = ['Lecture', 'Seminar', 'Workshop', 'Study Session', 'Deep Dive'];
  const token = videoId.slice(0, 3).toUpperCase();
  return `${fallbacks[videoId.charCodeAt(0) % fallbacks.length]} ${token} Recap`;
}

function synthesiseYoutubeChannel(videoId: string): string {
  const seeds = ['Campus Collective', 'Learning Loop', 'Insight Academy', 'Focus Lab', 'Course Companion'];
  const index = videoId.charCodeAt(videoId.length - 1) % seeds.length;
  return seeds[index];
}

async function simulateYoutubeTranscription(url: string): Promise<YoutubeTranscription> {
  const parsed = parseYoutubeVideoId(url);
  if (!parsed) {
    throw new Error('Enter a valid YouTube link.');
  }

  const { videoId, startOffset } = parsed;
  const videoTitle = synthesiseYoutubeTitle(videoId);
  const channelName = synthesiseYoutubeChannel(videoId);

  const topicSeeds = ['Overview', 'Key Ideas', 'Case Study', 'Takeaways', 'Next Steps'];
  const segments = topicSeeds.map((topic, index) => {
    const variantIndex = (videoId.charCodeAt(index % videoId.length) + index) % topicSeeds.length;
    const selectedTopic = topicSeeds[variantIndex];
    return {
      topic: `${selectedTopic}`,
      summary: `Detailed breakdown of ${selectedTopic.toLowerCase()} with definitions, examples, and prompts linked to ${channelName}.`,
      marker: `${index + 1}0:${index === 0 ? '05' : '45'}`
    };
  });

  const transcript = segments
    .map(
      (segment, index) =>
        `Chapter ${index + 1} (${segment.marker}) — ${segment.topic}: ${segment.summary} Highlighted moments reference ${videoTitle}.`
    )
    .join('\n\n');

  const keyTakeaways = segments.map(
    (segment) => `${segment.topic}: Capture the main definitions, numbered frameworks, and action steps.`
  );

  const numbers = segments.map((_, index) => `${index + 1}`).concat(videoId.slice(0, 4));

  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    transcript,
    segments,
    keyTakeaways,
    numbers,
    videoId,
    videoTitle,
    channelName,
    startOffset
  };
}

async function simulateAudioTranscription(file: File): Promise<SimulatedTranscription> {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ');
  const tokens = base.split(/[-\s]/).filter(Boolean);
  const fallbackTopics = ['Overview', 'Concepts', 'Examples', 'Next Steps'];
  const now = new Date();
  const readableDate = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  const selectedTopics = (tokens.length >= 2 ? tokens.slice(0, 4) : fallbackTopics).map((token, index) => ({
    topic: toTitleCase(token) || fallbackTopics[index],
    summary: `Discussion of ${toTitleCase(token) || fallbackTopics[index]} with definitions, supporting evidence, and study prompts.`,
    marker: `${index + 1}0:${index === 0 ? '00' : '30'}`
  }));

  const transcript = selectedTopics
    .map(
      (segment, index) =>
        `Segment ${index + 1} (${segment.marker}) — ${segment.topic}: ${segment.summary} Highlighted figures include ${index + 1} key metrics and the session date ${readableDate}.`
    )
    .join('\n\n');

  const keyTakeaways = selectedTopics.map(
    (segment) => `${segment.topic}: Focus on definitions, numbered steps, and follow-up actions.`
  );

  const numbers = selectedTopics.map((_, index) => `${index + 1}`).concat(readableDate);

  await new Promise((resolve) => setTimeout(resolve, 700));

  return {
    transcript,
    segments: selectedTopics,
    keyTakeaways,
    numbers
  };
}

function classDisplayName(course: { id: number; name: string; course_code?: string }) {
  if (course.name) return course.name;
  if (course.course_code) return course.course_code;
  return `Course ${course.id}`;
}

function contentLabel(type: NoteContentType): string {
  switch (type) {
    case 'text':
      return 'Typed text';
    case 'image':
      return 'Image upload';
    case 'audio':
      return 'Audio upload';
    case 'youtube':
      return 'YouTube video';
    default:
      return 'Note';
  }
}

export default function NoteLibrary() {
  const rawCourses = useRawCourses();
  const addNote = useNotesStore((state) => state.addNote);
  const notes = useNotesStore((state) => state.notes);
  const toggleFlashcards = useNotesStore((state) => state.toggleFlashcards);
  const toggleStudyPlan = useNotesStore((state) => state.toggleStudyPlan);
  const setToast = useStore((state) => state.setToast);
  const profile = useStore((state) => state.profile);
  const navigate = useNavigate();
  const registerAiTask = useAiUsageStore((state) => state.registerTask);

  const isPremium = profile?.plan === 'premium' || profile?.isPremium === true;

  const classOptions = useMemo(
    () =>
      rawCourses.map((course) => ({
        value: String(course.id),
        label: classDisplayName(course)
      })),
    [rawCourses]
  );

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    map.set(GENERAL_NOTE_CLASS_ID, 'General Notes');
    rawCourses.forEach((course) => {
      map.set(String(course.id), classDisplayName(course));
    });
    return map;
  }, [rawCourses]);

  const [linkClassId, setLinkClassId] = useState<string>(GENERAL_NOTE_CLASS_ID);
  const [viewFilter, setViewFilter] = useState<string>('all');
  const [mode, setMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAnalysis, setDraftAnalysis] = useState<DraftAnalysis | null>(null);
  const [draftSource, setDraftSource] = useState<{ type: InputMode; rawInputLink?: string; sourceName?: string; transcript?: string } | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const noteTokenEstimate = useMemo(() => {
    if (mode === 'text') {
      const base = estimateTokensFromText(textInput);
      if (!base) return null;
      const summary = Math.max(180, Math.round(base * 0.45));
      return { total: base + summary, category: 'summarize' as const };
    }
    if (mode === 'image') {
      if (!imageFile) return null;
      const size = imageFile.size || 0;
      const ocrTokens = Math.max(450, Math.round(size / 12));
      const summary = 320;
      return { total: ocrTokens + summary, category: 'parse' as const };
    }
    if (mode === 'audio') {
      if (!audioFile) return null;
      const size = audioFile.size || 0;
      const transcriptionTokens = Math.max(900, Math.round(size / 6));
      const recap = 420;
      return { total: transcriptionTokens + recap, category: 'transcribe' as const };
    }
    return null;
  }, [mode, textInput, imageFile, audioFile]);

  const filteredNotes = useMemo(() => {
    if (viewFilter === 'all') return notes;
    return notes.filter((note) => note.classId === viewFilter);
  }, [notes, viewFilter]);

  const noteCounts = useMemo(() => {
    return notes.reduce(
      (acc, note) => {
        acc.total += 1;
        if (note.useForFlashcards) acc.flashcards += 1;
        if (note.useForStudyPlan) acc.studyPlan += 1;
        return acc;
      },
      { total: 0, flashcards: 0, studyPlan: 0 }
    );
  }, [notes]);

  function resetDraft(nextMode?: InputMode) {
    setDraftNotes([]);
    setDraftTitle('');
    setDraftAnalysis(null);
    setDraftSource(null);
    setError(null);
    if (!nextMode || nextMode !== 'text') {
      setTextInput('');
    }
    if (!nextMode || nextMode !== 'image') {
      setImageFile(null);
    }
    if (!nextMode || nextMode !== 'audio') {
      setAudioFile(null);
    }
    if (!nextMode || nextMode !== 'youtube') {
      setYoutubeUrl('');
    }
  }

  function handleModeChange(nextMode: InputMode) {
    if (mode === nextMode) return;
    setMode(nextMode);
    resetDraft(nextMode);
  }

  async function processInput() {
    try {
      setError(null);
      setIsProcessing(true);
      let pendingTask:
        | {
            label: string;
            category: 'summarize' | 'parse' | 'transcribe';
            steps: Array<{ label: string; tokenEstimate: number }>;
            metadata?: Record<string, unknown>;
          }
        | null = null;
      if (mode === 'text') {
        const trimmed = textInput.trim();
        if (!trimmed) {
          setError('Add or paste some text before running the AI organiser.');
          return;
        }
        const { blocks, analysis } = buildBlocksFromText(trimmed);
        if (blocks.length === 0) {
          setError('No note blocks detected. Add more structure or try again.');
          return;
        }
        setDraftNotes(blocks);
        setDraftAnalysis(analysis);
        setDraftSource({ type: 'text', transcript: trimmed });
        setDraftTitle(analysis.suggestedTitle ?? '');
        const interpretationTokens = estimateTokensFromText(trimmed);
        const structuringTokens = estimateTokensFromTexts([
          blocks.join('\n'),
          analysis.keyTakeaways.join(' '),
          analysis.topics.map((topic) => `${topic.heading}: ${topic.detail}`).join('\n')
        ]);
        pendingTask = {
          label: 'Organise typed notes',
          category: 'summarize',
          steps: [
            { label: 'Interpret text', tokenEstimate: interpretationTokens },
            { label: 'Cluster highlights', tokenEstimate: structuringTokens }
          ],
          metadata: {
            source: 'text',
            blockCount: blocks.length
          }
        };
      } else if (mode === 'image') {
        if (!imageFile) {
          setError('Choose an image to run OCR.');
          return;
        }
        const extracted = await simulateImageOcr(imageFile);
        const { blocks, analysis } = buildBlocksFromText(extracted);
        if (blocks.length === 0) {
          setError('The OCR result did not include enough readable text. Try another image.');
          return;
        }
        setDraftNotes(blocks);
        setDraftAnalysis(analysis);
        setDraftSource({
          type: 'image',
          rawInputLink: `local-file:${imageFile.name}`,
          sourceName: imageFile.name,
          transcript: extracted
        });
        setDraftTitle(analysis.suggestedTitle ?? toTitleCase(imageFile.name.replace(/\.[^.]+$/, '')));
        const ocrTokens = estimateTokensFromText(extracted) + 150;
        const organisationTokens = estimateTokensFromTexts([
          blocks.join('\n'),
          analysis.keyTakeaways.join(' ')
        ]);
        pendingTask = {
          label: 'OCR & organise image notes',
          category: 'parse',
          steps: [
            { label: 'Extract handwriting', tokenEstimate: ocrTokens },
            { label: 'Summarise highlights', tokenEstimate: organisationTokens }
          ],
          metadata: {
            source: 'image',
            fileName: imageFile.name
          }
        };
      } else if (mode === 'audio') {
        if (!audioFile) {
          setError('Select an audio file to transcribe.');
          return;
        }
        if (!isPremium) {
          setShowUpgrade(true);
          return;
        }
        const transcription = await simulateAudioTranscription(audioFile);
        const { blocks, analysis } = buildBlocksFromText(transcription.transcript);
        const mergedBlocks = transcription.segments.length
          ? transcription.segments.map((segment) => `${segment.topic}: ${segment.summary}`)
          : blocks;
        const mergedAnalysis: DraftAnalysis = {
          keyTakeaways: transcription.keyTakeaways.length
            ? transcription.keyTakeaways
            : analysis.keyTakeaways,
          topics: transcription.segments.length
            ? transcription.segments.map((segment) => ({ heading: segment.topic, detail: segment.summary }))
            : analysis.topics,
          numbers: Array.from(new Set([...transcription.numbers, ...analysis.numbers])),
          rawText: transcription.transcript,
          transcript: transcription.transcript,
          suggestedTitle: analysis.suggestedTitle
        };
        if (mergedBlocks.length === 0) {
          setError('Transcription succeeded but no clear topics were detected.');
          return;
        }
        setDraftNotes(mergedBlocks);
        setDraftAnalysis(mergedAnalysis);
        setDraftSource({
          type: 'audio',
          rawInputLink: `local-file:${audioFile.name}`,
          sourceName: audioFile.name,
          transcript: transcription.transcript
        });
        setDraftTitle(mergedAnalysis.suggestedTitle ?? `${toTitleCase(audioFile.name.replace(/\.[^.]+$/, ''))} recap`);
        const transcriptionTokens = estimateTokensFromText(transcription.transcript) + 400;
        const recapTokens = estimateTokensFromTexts([
          mergedBlocks.join('\n'),
          mergedAnalysis.keyTakeaways.join(' ')
        ]);
        pendingTask = {
          label: 'Transcribe & organise audio notes',
          category: 'transcribe',
          steps: [
            { label: 'Transcribe audio', tokenEstimate: transcriptionTokens },
            { label: 'Outline recap', tokenEstimate: recapTokens }
          ],
          metadata: {
            source: 'audio',
            fileName: audioFile.name,
            segmentCount: transcription.segments.length
          }
        };
      } else if (mode === 'youtube') {
        if (!youtubeUrl.trim()) {
          setError('Enter a YouTube URL to transcribe.');
          return;
        }
        if (!isPremium) {
          setShowUpgrade(true);
          return;
        }
        const transcription = await simulateYoutubeTranscription(youtubeUrl.trim());
        const { blocks, analysis } = buildBlocksFromText(transcription.transcript);
        const mergedBlocks = transcription.segments.length
          ? transcription.segments.map((segment) => `${segment.topic}: ${segment.summary}`)
          : blocks;
        const mergedAnalysis: DraftAnalysis = {
          keyTakeaways: transcription.keyTakeaways.length
            ? transcription.keyTakeaways
            : analysis.keyTakeaways,
          topics: transcription.segments.length
            ? transcription.segments.map((segment) => ({ heading: segment.topic, detail: segment.summary }))
            : analysis.topics,
          numbers: Array.from(new Set([...transcription.numbers, ...analysis.numbers])),
          rawText: transcription.transcript,
          transcript: transcription.transcript,
          suggestedTitle: analysis.suggestedTitle
        };
        if (mergedBlocks.length === 0) {
          setError('YouTube transcription succeeded but no clear topics were detected.');
          return;
        }
        setDraftNotes(mergedBlocks);
        setDraftAnalysis(mergedAnalysis);
        setDraftSource({
          type: 'youtube',
          rawInputLink: youtubeUrl.trim(),
          sourceName: transcription.videoTitle,
          transcript: transcription.transcript
        });
        setDraftTitle(mergedAnalysis.suggestedTitle ?? transcription.videoTitle);
        const transcriptionTokens = estimateTokensFromText(transcription.transcript) + 400;
        const recapTokens = estimateTokensFromTexts([
          mergedBlocks.join('\n'),
          mergedAnalysis.keyTakeaways.join(' ')
        ]);
        pendingTask = {
          label: 'Transcribe & organise YouTube video',
          category: 'transcribe',
          steps: [
            { label: 'Extract YouTube transcript', tokenEstimate: transcriptionTokens },
            { label: 'Outline recap', tokenEstimate: recapTokens }
          ],
          metadata: {
            source: 'youtube',
            videoId: transcription.videoId,
            videoTitle: transcription.videoTitle,
            channelName: transcription.channelName,
            segmentCount: transcription.segments.length
          }
        };
      }

      if (pendingTask) {
        registerAiTask(pendingTask);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function handleSaveDraft() {
    if (draftNotes.length === 0) {
      setError('Organise notes before saving.');
      return;
    }

    const targetClassId = linkClassId || GENERAL_NOTE_CLASS_ID;
    const noteId = addNote({
      classId: targetClassId,
      contentType: draftSource?.type ?? mode,
      rawInputLink: draftSource?.rawInputLink,
      parsedNotes: draftNotes,
      title: draftTitle,
      sourceName: draftSource?.sourceName,
      transcript: draftSource?.transcript,
      tags: draftAnalysis?.topics ? Array.from(new Set(draftAnalysis.topics.map((topic) => topic.heading))) : [],
      useForFlashcards: false,
      useForStudyPlan: false
    });

    const className = classLookup.get(targetClassId) ?? 'selected class';
    setToast(`Saved notes to ${className}.`);
    resetDraft(mode);
    if (noteId && viewFilter === 'all') {
      // keep latest note visible in history by scrolling into view if needed later
    }
  }

  function quickSaveCurrentText() {
    setError(null);
    if (mode !== 'text') {
      setError('Quick save is available for typed notes. Use AI organise for uploads.');
      return;
    }

    const trimmed = textInput.trim();
    if (!trimmed) {
      setError('Add some text before saving.');
      return;
    }

    const normalised = normaliseWhitespace(trimmed);
    const paragraphs = normalised
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    const blocks = paragraphs.length > 0 ? paragraphs : [normalised];
    const targetClassId = linkClassId || GENERAL_NOTE_CLASS_ID;

    addNote({
      classId: targetClassId,
      contentType: 'text',
      parsedNotes: blocks,
      transcript: normalised,
      title: deriveTitleFromText(normalised)
    });

    const className = classLookup.get(targetClassId) ?? 'selected class';
    setToast(`Saved notes to ${className}.`);
    setTextInput('');
    resetDraft('text');
  }

  function renderDraftEditor() {
    if (draftNotes.length === 0) return null;

    return (
      <section className="dashboard-card note-draft" aria-live="polite">
        <div className="note-draft__header">
          <div>
            <h2>Review &amp; confirm notes</h2>
            <p>Fine-tune AI generated blocks before adding them to your study library.</p>
          </div>
          <div className="note-draft__title">
            <label htmlFor="note-draft-title">Title</label>
            <input
              id="note-draft-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Optional title"
            />
          </div>
        </div>
        <div className="note-draft__notes">
          {draftNotes.map((note, index) => (
            <div key={`draft-${index}`} className="note-draft__item">
              <label htmlFor={`note-draft-${index}`}>Block {index + 1}</label>
              <textarea
                id={`note-draft-${index}`}
                value={note}
                onChange={(event) => {
                  const updated = [...draftNotes];
                  updated[index] = event.target.value;
                  setDraftNotes(updated);
                }}
                rows={3}
              />
              <div className="note-draft__item-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (index > 0) {
                      const updated = [...draftNotes];
                      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
                      setDraftNotes(updated);
                    }
                  }}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index < draftNotes.length - 1) {
                      const updated = [...draftNotes];
                      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                      setDraftNotes(updated);
                    }
                  }}
                  disabled={index === draftNotes.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftNotes(draftNotes.filter((_, idx) => idx !== index));
                  }}
                  title="Remove block"
                >
                  Remove block
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="note-draft__footer">
          <button
            type="button"
            className="note-draft__add"
            onClick={() => setDraftNotes([...draftNotes, ''])}
          >
            Add another note block
          </button>
          <button type="button" className="note-draft__save" onClick={handleSaveDraft}>
            Save to library
          </button>
        </div>
        {draftAnalysis ? (
          <div className="note-analysis">
            {draftAnalysis.keyTakeaways.length > 0 ? (
              <div className="note-analysis__section">
                <h3>Key takeaways</h3>
                <ul>
                  {draftAnalysis.keyTakeaways.map((item, index) => (
                    <li key={`takeaway-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draftAnalysis.topics.length > 0 ? (
              <div className="note-analysis__section">
                <h3>Topics detected</h3>
                <ul>
                  {draftAnalysis.topics.slice(0, 6).map((topic, index) => (
                    <li key={`topic-${index}`}>
                      <strong>{topic.heading}</strong>
                      <span>{topic.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draftAnalysis.numbers.length > 0 ? (
              <div className="note-analysis__section">
                <h3>Dates &amp; numbers spotted</h3>
                <div className="note-analysis__pill-row">
                  {draftAnalysis.numbers.slice(0, 8).map((value) => (
                    <span key={value} className="note-analysis__pill">
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  function renderHistoryCard(note: NoteRecord) {
    return (
      <article key={note.id} className="note-card">
        <header className="note-card__header">
          <div>
            <h3>{note.title}</h3>
            <p className="note-card__meta">
              {timestampFormatter.format(new Date(note.createdAt))} · {contentLabel(note.contentType)} ·{' '}
              {classLookup.get(note.classId) ?? 'Unlinked'}
            </p>
          </div>
        </header>
        <div className="note-card__body">
          <ul>
            {note.parsedNotes.map((entry, index) => (
              <li key={`${note.id}-entry-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
        <footer className="note-card__footer">
          <div className="note-card__toggles">
            <label>
              <input
                type="checkbox"
                checked={note.useForFlashcards}
                onChange={() => toggleFlashcards(note.id)}
              />
              Use for Flashcards
            </label>
            <label>
              <input
                type="checkbox"
                checked={note.useForStudyPlan}
                onChange={() => toggleStudyPlan(note.id)}
              />
              Use for Study Plan
            </label>
          </div>
          {note.tags.length > 0 ? (
            <div className="note-card__tags">
              {note.tags.map((tag) => (
                <span key={`${note.id}-${tag}`} className="note-card__tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {note.transcript ? (
            <details className="note-card__transcript">
              <summary>View original transcription</summary>
              <pre>{note.transcript}</pre>
            </details>
          ) : null}
        </footer>
      </article>
    );
  }

  return (
    <AppShell pageTitle="AI note library">
      <div className="note-library">
        <section className="dashboard-card note-library__ingest">
          <header className="note-library__header">
            <div>
              <h2>Upload &amp; organise class notes</h2>
              <p>
                Link raw notes to a class, let the AI clean everything up, then reuse them across flashcards and
                study plans.
              </p>
            </div>
            <div className="note-library__class">
              <label htmlFor="note-class-select">Link to class</label>
              <select
                id="note-class-select"
                value={linkClassId}
                onChange={(event) => setLinkClassId(event.target.value)}
              >
                <option value={GENERAL_NOTE_CLASS_ID}>General notes</option>
                {classOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </header>
          <div className="note-library__modes" role="tablist" aria-label="Note input types">
            {INPUT_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={`note-library__mode ${mode === item.id ? 'note-library__mode--active' : ''}`}
                onClick={() => handleModeChange(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
          <div className="note-library__input" role="tabpanel">
            {mode === 'text' ? (
              <div className="note-library__field">
                <label htmlFor="note-text-input">Paste or type your notes</label>
                <textarea
                  id="note-text-input"
                  rows={8}
                  placeholder="Write or paste the raw notes you captured in class so the AI can organise them."
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                />
              </div>
            ) : null}
            {mode === 'image' ? (
              <div className="note-library__field">
                <label htmlFor="note-image-input">Upload an image</label>
                <input
                  id="note-image-input"
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setImageFile(file ?? null);
                  }}
                />
                {imageFile ? <p className="note-library__file">Selected: {imageFile.name}</p> : null}
              </div>
            ) : null}
            {mode === 'audio' ? (
              <div className="note-library__field">
                <label htmlFor="note-audio-input">Upload an audio file (MP3, WAV, M4A)</label>
                <input
                  id="note-audio-input"
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,audio/m4a"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && !isPremium) {
                      setShowUpgrade(true);
                      event.target.value = '';
                      return;
                    }
                    setAudioFile(file ?? null);
                  }}
                />
                {audioFile ? <p className="note-library__file">Selected: {audioFile.name}</p> : null}
                {!isPremium ? (
                  <p className="note-library__premium-hint">
                    Audio uploads are a premium feature. Upgrade to unlock lecture transcriptions.
                  </p>
                ) : null}
              </div>
            ) : null}
            {mode === 'youtube' ? (
              <div className="note-library__field">
                <label htmlFor="note-youtube-input">Paste a YouTube link</label>
                <input
                  id="note-youtube-input"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(event) => {
                    const url = event.target.value;
                    if (url && !isPremium) {
                      setShowUpgrade(true);
                      return;
                    }
                    setYoutubeUrl(url);
                  }}
                />
                {youtubeUrl ? <p className="note-library__file">YouTube URL: {youtubeUrl}</p> : null}
                {!isPremium ? (
                  <p className="note-library__premium-hint">
                    YouTube transcription is a premium feature. Upgrade to unlock video note generation.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="note-library__actions">
            <button
              type="button"
              className="note-library__save"
              onClick={quickSaveCurrentText}
              disabled={mode !== 'text' || textInput.trim().length === 0 || isProcessing}
            >
              Save
            </button>
            <button type="button" onClick={processInput} disabled={isProcessing}>
              {isProcessing ? 'Processing…' : 'Organise with AI'}
            </button>
            {noteTokenEstimate ? (
              <AiTokenBadge category={noteTokenEstimate.category} tokens={noteTokenEstimate.total} />
            ) : null}
          </div>
          {error ? <p className="note-library__error">{error}</p> : null}
        </section>

        {renderDraftEditor()}

        <section className="dashboard-card note-library__history">
          <header className="note-library__history-header">
            <div>
              <h2>Note history</h2>
              <p>
                {noteCounts.total === 0
                  ? 'No notes saved yet. Process a file or paste text to get started.'
                  : `${noteCounts.total} saved • ${noteCounts.flashcards} flagged for flashcards • ${noteCounts.studyPlan} in study plans.`}
              </p>
            </div>
            <div className="note-library__filters">
              <label htmlFor="note-filter-select">View</label>
              <select
                id="note-filter-select"
                value={viewFilter}
                onChange={(event) => setViewFilter(event.target.value)}
              >
                <option value="all">All notes</option>
                <option value={GENERAL_NOTE_CLASS_ID}>General notes</option>
                {classOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </header>
          {filteredNotes.length === 0 ? (
            <p className="note-library__empty">No stored notes for this view yet.</p>
          ) : (
            <div className="note-library__history-grid">
              {filteredNotes.map((note) => renderHistoryCard(note))}
            </div>
          )}
        </section>
      </div>

      {showUpgrade ? (
        <div className="note-upgrade" role="dialog" aria-modal="true" aria-labelledby="note-upgrade-title">
          <div className="note-upgrade__card">
            <h3 id="note-upgrade-title">Unlock lecture transcriptions</h3>
            <p>
              Audio uploads are part of DueD8 Premium. Upgrade to get AI-powered transcriptions, topic detection,
              and summary exports.
            </p>
            <div className="note-upgrade__actions">
              <button type="button" onClick={() => setShowUpgrade(false)}>
                Not now
              </button>
              <button
                type="button"
                className="note-upgrade__cta"
                onClick={() => {
                  setShowUpgrade(false);
                  navigate('/pricing');
                }}
              >
                View plans
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
