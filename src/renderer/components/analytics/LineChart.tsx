import React from 'react';

export type LineChartDataPoint = {
  label: string;
  value: number;
  date?: string;
};

type LineChartProps = {
  data: LineChartDataPoint[];
  title?: string;
  color?: string;
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  showDots?: boolean;
};

export default function LineChart({
  data,
  title,
  color = 'var(--primary)',
  height = 200,
  yAxisLabel,
  formatValue = (value) => value.toString(),
  showDots = true
}: LineChartProps) {
  if (!data.length) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14
      }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const padding = 40;
  const chartWidth = 100 - (padding * 2 / 300 * 100); // Adjust based on container
  const chartHeight = height - 60;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (300 - padding * 2);
    const y = padding + ((maxValue - point.value) / range) * chartHeight;
    return { x, y, ...point };
  });

  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <h4 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 16, 
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          {title}
        </h4>
      )}
      <div style={{ position: 'relative', width: '100%', height }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 300 ${height}`}
          style={{ overflow: 'visible' }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => {
            const y = padding + (percent / 100) * chartHeight;
            return (
              <line
                key={percent}
                x1={padding}
                y1={y}
                x2={300 - padding}
                y2={y}
                stroke="var(--surface-border)"
                strokeWidth="1"
                opacity="0.5"
              />
            );
          })}

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {showDots && points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
                stroke="white"
                strokeWidth="2"
              />
              {/* Tooltip on hover */}
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="transparent"
                style={{ cursor: 'pointer' }}
              >
                <title>{`${point.label}: ${formatValue(point.value)}`}</title>
              </circle>
            </g>
          ))}

          {/* Y-axis labels */}
          {[minValue, (minValue + maxValue) / 2, maxValue].map((value, index) => {
            const y = padding + (index * chartHeight / 2);
            return (
              <text
                key={index}
                x={padding - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-secondary)"
              >
                {formatValue(value)}
              </text>
            );
          })}

          {/* X-axis labels */}
          {points.map((point, index) => {
            if (data.length > 6 && index % Math.ceil(data.length / 6) !== 0) return null;
            return (
              <text
                key={index}
                x={point.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--text-secondary)"
              >
                {point.label}
              </text>
            );
          })}
        </svg>

        {yAxisLabel && (
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}
          >
            {yAxisLabel}
          </div>
        )}
      </div>
    </div>
  );
}
