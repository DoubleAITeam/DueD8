export function estimateTokenCount(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.length;
}

export function trimTextToTokenLimit(text: string, maxTokens: number): {
  text: string;
  tokensUsed: number;
  truncated: boolean;
} {
  if (maxTokens <= 0) {
    return { text: '', tokensUsed: 0, truncated: text.trim().length > 0 };
  }

  const lines = text.split('\n');
  const keptLines: string[] = [];
  let used = 0;
  let truncated = false;

  for (const line of lines) {
    const trimmedLine = line.trimEnd();
    if (!trimmedLine.length) {
      keptLines.push(line);
      continue;
    }

    const lineTokenCount = estimateTokenCount(trimmedLine);
    if (used + lineTokenCount <= maxTokens) {
      keptLines.push(trimmedLine);
      used += lineTokenCount;
      continue;
    }

    const remaining = maxTokens - used;
    if (remaining > 0) {
      const words = trimmedLine.split(/\s+/);
      const slice = words.slice(0, remaining);
      let partial = slice.join(' ').trimEnd();
      if (partial.length && !/[.!?]$/.test(partial)) {
        partial = `${partial}…`;
      }
      keptLines.push(partial);
      used += estimateTokenCount(partial);
    }

    truncated = true;
    break;
  }

  const normalised = keptLines.join('\n').replace(/\n{3,}/g, '\n\n');
  return { text: normalised.trimEnd(), tokensUsed: used, truncated };
}
