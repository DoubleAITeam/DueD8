import React from 'react';

type ProgressBarProps = {
  value: number;
  color?: 'primary' | 'blue' | 'green' | 'purple' | 'warning';
  ariaLabel?: string;
};

export default function ProgressBar({ value, color = 'primary', ariaLabel }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress-bar progress-bar--${color}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel}>
      <div className="progress-bar__track">
        <div className="progress-bar__indicator" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
