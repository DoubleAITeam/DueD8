import React from 'react';

export type PieChartDataPoint = {
  label: string;
  value: number;
  color?: string;
};

type PieChartProps = {
  data: PieChartDataPoint[];
  title?: string;
  size?: number;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
  showPercentages?: boolean;
};

export default function PieChart({
  data,
  title,
  size = 200,
  showLegend = true,
  formatValue = (value) => value.toString(),
  showPercentages = true
}: PieChartProps) {
  if (!data.length) {
    return (
      <div style={{ 
        height: size, 
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

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = ['var(--bar-blue)', 'var(--bar-green)', 'var(--bar-purple)', 'var(--primary)', '#f59e0b', '#ef4444'];
  
  let currentAngle = 0;
  const segments = data.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;

    const color = item.color || colors[index % colors.length];
    
    // Calculate path for SVG arc
    const radius = size / 2 - 20;
    const centerX = size / 2;
    const centerY = size / 2;
    
    const startAngleRad = (startAngle - 90) * (Math.PI / 180);
    const endAngleRad = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    return {
      ...item,
      color,
      percentage,
      pathData
    };
  });

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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 24,
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative' }}>
          <svg width={size} height={size}>
            {segments.map((segment, index) => (
              <g key={index}>
                <path
                  d={segment.pathData}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                >
                  <title>
                    {`${segment.label}: ${formatValue(segment.value)} (${segment.percentage.toFixed(1)}%)`}
                  </title>
                </path>
              </g>
            ))}
          </svg>
        </div>
        
        {showLegend && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 8,
            flex: 1,
            minWidth: 150
          }}>
            {segments.map((segment, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                fontSize: 13
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: segment.color,
                  flexShrink: 0
                }} />
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>
                  {segment.label}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {showPercentages 
                    ? `${segment.percentage.toFixed(1)}%` 
                    : formatValue(segment.value)
                  }
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
