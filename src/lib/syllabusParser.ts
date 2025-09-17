export type GradeBand = {
  label: string;
  min: number;
  max: number;
};

export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { label: 'A', min: 90, max: 100 },
  { label: 'B', min: 80, max: 89 },
  { label: 'C', min: 70, max: 79 },
  { label: 'D', min: 60, max: 69 },
  { label: 'F', min: 0, max: 59 }
];

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
};

const GRADE_REGEX = /(A\+?|A-|B\+?|B-|C\+?|C-|D\+?|D-|F)\s*(?:=|:)?\s*(?:>=|≥)?\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*%?/gi;

function cleanSyllabus(html?: string | null) {
  if (!html) return '';
  let text = html;
  for (const [entity, value] of Object.entries(ENTITY_MAP)) {
    text = text.replace(new RegExp(entity, 'gi'), value);
  }
  return text
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

// PHASE 4: Extract a usable grading scale from the free-form syllabus body.
export function parseSyllabusScale(syllabus?: string | null): GradeBand[] {
  const text = cleanSyllabus(syllabus);
  if (!text) return [];
  const matches: GradeBand[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = GRADE_REGEX.exec(text)) !== null) {
    const label = match[1].toUpperCase();
    if (seen.has(label)) continue;
    const start = Number.parseInt(match[2], 10);
    const endRaw = match[3] ? Number.parseInt(match[3], 10) : 100;
    if (Number.isNaN(start)) continue;
    const min = Math.min(start, endRaw);
    const max = Math.max(start, endRaw);
    matches.push({ label, min, max });
    seen.add(label);
  }
  matches.sort((a, b) => b.min - a.min);
  return matches;
}
