import React from 'react';

const sharedProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

export function CalendarIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...sharedProps}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...sharedProps}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...sharedProps}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
