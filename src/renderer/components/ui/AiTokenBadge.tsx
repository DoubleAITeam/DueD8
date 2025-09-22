import React from 'react';
import type { AiTaskCategory } from '../../state/aiUsage';
import { formatTokenEstimate } from '../../state/aiUsage';

const CATEGORY_LABELS: Record<AiTaskCategory, string> = {
  parse: 'AI parse',
  generate: 'AI generate',
  summarize: 'AI summarize',
  chat: 'AI chat',
  transcribe: 'AI transcribe',
  analyze: 'AI analyze'
};

type AiTokenBadgeProps = {
  category: AiTaskCategory;
  tokens?: number | null;
  size?: 'sm' | 'md';
  label?: string;
};

export default function AiTokenBadge({ category, tokens, size = 'sm', label }: AiTokenBadgeProps) {
  const baseLabel = label ?? CATEGORY_LABELS[category];
  const hasTokens = typeof tokens === 'number' && Number.isFinite(tokens) && tokens > 0;
  const formatted = hasTokens ? `~${formatTokenEstimate(tokens)} tokens` : null;
  return (
    <span className={`ai-token-badge ai-token-badge--${size}`}>
      {baseLabel}
      {formatted ? <span className="ai-token-badge__tokens">{formatted}</span> : null}
    </span>
  );
}
