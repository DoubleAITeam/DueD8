import React from 'react';
import BarChart from './BarChart';

type SubmissionPatternsProps = {
  onTimeCount: number;
  lateCount: number;
  missingCount: number;
};

export default function SubmissionPatternsChart({ onTimeCount, lateCount, missingCount }: SubmissionPatternsProps) {
  const total = onTimeCount + lateCount + missingCount;
  
  if (total === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: 200,
        color: 'var(--text-secondary)',
        fontSize: 14
      }}>
        No submission data available
      </div>
    );
  }

  const data = [
    {
      label: 'On Time',
      value: onTimeCount,
      color: 'var(--success)'
    },
    {
      label: 'Late',
      value: lateCount,
      color: 'var(--warning)'
    },
    {
      label: 'Missing',
      value: missingCount,
      color: 'var(--error)'
    }
  ].filter(item => item.value > 0);

  const onTimePercentage = ((onTimeCount / total) * 100).toFixed(0);

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16,
        padding: 16,
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderRadius: 12,
        border: '1px solid rgba(34, 197, 94, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
            {onTimePercentage}%
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Submitted on time
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
          {onTimeCount} on time, {lateCount} late, {missingCount} missing
        </div>
      </div>
      
      <BarChart
        data={data}
        horizontal
        showValues
        formatValue={(value) => `${value} assignment${value !== 1 ? 's' : ''}`}
        height={150}
      />
    </div>
  );
}
