const BANNED = [
  'Important Reminders',
  'submit this as a PDF',
  'plagiarism',
  'Department Chair',
  '[SOURCE NEEDED]',
  '<div',
  'style=',
  'canvas.gmu.edu'
];

export function lintDeliverableText(text: string) {
  for (const token of BANNED) {
    if (text.toLowerCase().includes(token.toLowerCase())) {
      throw new Error(`Banned token detected: ${token}`);
    }
  }
  return text.replace(/\.\./g, '.');
}

export function getBannedTokens() {
  return [...BANNED];
}
