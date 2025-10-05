import { isRedactionEnabled } from './config';

const REDACTION_PATTERNS = [
  'Emails',
  'Phone numbers',
  'Student IDs',
  'Named fields (Name:, Student:, Instructor:, Professor:)'
];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\b(?:\+?1[-.\s]*)?(?:\(\d{3}\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}\b/g;
const STUDENT_ID_REGEX = /\b(?:\d{7,}|[A-Z]{2,3}\d{4,})\b/g;
const NAMED_FIELD_REGEX = /\b(?:Name|Student|Instructor|Professor)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;

function applyReplacement(
  source: string,
  regex: RegExp,
  replacement: string
): { text: string; changed: boolean } {
  let changed = false;
  const text = source.replace(regex, (match, group) => {
    changed = true;
    if (typeof group === 'string') {
      return match.replace(group, replacement);
    }
    return replacement;
  });
  return { text, changed };
}

export function redactText(raw: string): { text: string; redacted: boolean } {
  if (!raw) {
    return { text: raw, redacted: false };
  }
  let working = raw;
  let redacted = false;

  const emailResult = applyReplacement(working, EMAIL_REGEX, '[redacted email]');
  working = emailResult.text;
  redacted ||= emailResult.changed;

  const phoneResult = applyReplacement(working, PHONE_REGEX, '[redacted phone]');
  working = phoneResult.text;
  redacted ||= phoneResult.changed;

  const idResult = applyReplacement(working, STUDENT_ID_REGEX, '[redacted id]');
  working = idResult.text;
  redacted ||= idResult.changed;

  const nameResult = applyReplacement(working, NAMED_FIELD_REGEX, '[redacted name]');
  working = nameResult.text;
  redacted ||= nameResult.changed;

  return { text: working, redacted };
}

export function maybeRedactText(raw: string | undefined): { text?: string; redacted: boolean } {
  if (typeof raw !== 'string') {
    return { text: raw, redacted: false };
  }
  if (!isRedactionEnabled()) {
    return { text: raw, redacted: false };
  }
  return redactText(raw);
}

export function getRedactionPatterns(): string[] {
  return [...REDACTION_PATTERNS];
}
