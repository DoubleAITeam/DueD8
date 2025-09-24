import React from 'react';

export type BarChartDataPoint = {
  label: string;
  value: number;
  color?: string;
};

type BarChartProps = {
  data: BarChartDataPoint[];
  title?: string;
  height?: number;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
  showValues?: boolean;
};

export default function BarChart({
  data,
  title,
  height = 200,
  horizontal = false,
  formatValue = (value) => value.toString(),
  showValues = false
}: BarChartProps) {
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
  const colors = ['var(--bar-blue)', 'var(--bar-green)', 'var(--bar-purple)', 'var(--primary)'];

  if (horizontal) {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((item, index) => {
            const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const color = item.color || colors[index % colors.length];
            
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  minWidth: 80, 
                  fontSize: 13, 
                  color: 'var(--text-secondary)',
                  textAlign: 'right'
                }}>
                  {item.label}
                </div>
                <div style={{ 
                  flex: 1, 
                  height: 24, 
                  backgroundColor: 'var(--surface-border)', 
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      backgroundColor: color,
                      borderRadius: 12,
                      transition: 'width 0.3s ease'
                    }}
                  />
                  {showValues && (
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 11,
                      color: percentage > 50 ? 'white' : 'var(--text-secondary)',
                      fontWeight: 500
                    }}>
                      {formatValue(item.value)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical bar chart
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
        alignItems: 'end', 
        justifyContent: 'space-between',
        height: height - 40,
        gap: 8,
        padding: '0 8px'
      }}>
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const color = item.color || colors[index % colors.length];
          const barHeight = (height - 60) * (percentage / 100);
          
          return (
            <div key={index} style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ 
                position: 'relative',
                width: '100%',
                maxWidth: 40,
                height: barHeight,
                backgroundColor: color,
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease'
              }}>
                {showValues && (
                  <div style={{
                    position: 'absolute',
                    top: -20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {formatValue(item.value)}
                  </div>
                )}
              </div>
              <div style={{ 
                fontSize: 11, 
                color: 'var(--text-secondary)',
                textAlign: 'center',
                maxWidth: 60,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
