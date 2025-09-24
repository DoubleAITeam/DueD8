import React from 'react';

export type HeatmapDataPoint = {
  date: string; // ISO date string
  value: number;
  label?: string;
};

type HeatmapProps = {
  data: HeatmapDataPoint[];
  title?: string;
  startDate?: Date;
  endDate?: Date;
  colorScheme?: 'blue' | 'green' | 'purple';
  formatValue?: (value: number) => string;
  showLabels?: boolean;
};

export default function Heatmap({
  data,
  title,
  startDate,
  endDate,
  colorScheme = 'blue',
  formatValue = (value) => value.toString(),
  showLabels = true
}: HeatmapProps) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = endDate || now;
  
  // Create a map of date -> value for quick lookup
  const dataMap = new Map(
    data.map(item => [item.date.split('T')[0], item])
  );

  // Generate all dates in the range
  const dates: Array<{ date: Date; dateStr: string; data?: HeatmapDataPoint }> = [];
  const current = new Date(start);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    dates.push({
      date: new Date(current),
      dateStr,
      data: dataMap.get(dateStr)
    });
    current.setDate(current.getDate() + 1);
  }

  // Calculate max value for color intensity
  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Color schemes
  const colorSchemes = {
    blue: {
      light: 'rgba(59, 130, 246, 0.1)',
      medium: 'rgba(59, 130, 246, 0.4)',
      dark: 'rgba(59, 130, 246, 0.8)'
    },
    green: {
      light: 'rgba(34, 197, 94, 0.1)',
      medium: 'rgba(34, 197, 94, 0.4)',
      dark: 'rgba(34, 197, 94, 0.8)'
    },
    purple: {
      light: 'rgba(168, 85, 247, 0.1)',
      medium: 'rgba(168, 85, 247, 0.4)',
      dark: 'rgba(168, 85, 247, 0.8)'
    }
  };

  const colors = colorSchemes[colorScheme];

  const getIntensityColor = (value: number) => {
    if (value === 0) return 'var(--surface-border)';
    const intensity = value / maxValue;
    if (intensity <= 0.33) return colors.light;
    if (intensity <= 0.66) return colors.medium;
    return colors.dark;
  };

  // Group dates by week
  const weeks: Array<Array<typeof dates[0]>> = [];
  let currentWeek: Array<typeof dates[0]> = [];
  
  dates.forEach((dateInfo, index) => {
    const dayOfWeek = dateInfo.date.getDay();
    
    // Start new week on Sunday
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentWeek.push(dateInfo);
    
    // Add the last week
    if (index === dates.length - 1) {
      weeks.push(currentWeek);
    }
  });

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
        flexDirection: 'column',
        gap: 8,
        fontSize: 11,
        color: 'var(--text-secondary)'
      }}>
        {/* Month labels */}
        <div style={{ 
          display: 'flex',
          paddingLeft: 30,
          gap: 2
        }}>
          {weeks.map((week, weekIndex) => {
            const firstDay = week[0]?.date;
            if (!firstDay || firstDay.getDate() > 7) return <div key={weekIndex} style={{ width: 12 }} />;
            
            return (
              <div key={weekIndex} style={{ 
                width: 12,
                textAlign: 'center',
                fontSize: 10
              }}>
                {monthLabels[firstDay.getMonth()]}
              </div>
            );
          })}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Day labels */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 2,
            width: 25
          }}>
            {dayLabels.map((day, index) => (
              <div key={index} style={{ 
                height: 12,
                display: 'flex',
                alignItems: 'center',
                fontSize: 9,
                textAlign: 'right'
              }}>
                {index % 2 === 1 ? day : ''}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div style={{ 
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            maxWidth: 'calc(100% - 35px)'
          }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const dateInfo = week.find(d => d.date.getDay() === dayIndex);
                  const value = dateInfo?.data?.value || 0;
                  
                  return (
                    <div
                      key={dayIndex}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: dateInfo ? getIntensityColor(value) : 'transparent',
                        cursor: dateInfo ? 'pointer' : 'default',
                        border: dateInfo ? '1px solid var(--surface-border)' : 'none'
                      }}
                      title={
                        dateInfo 
                          ? `${dateInfo.date.toLocaleDateString()}: ${formatValue(value)}`
                          : ''
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          marginTop: 12,
          fontSize: 10
        }}>
          <span>Less</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2,
              backgroundColor: 'var(--surface-border)',
              border: '1px solid var(--surface-border)'
            }} />
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2,
              backgroundColor: colors.light,
              border: '1px solid var(--surface-border)'
            }} />
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2,
              backgroundColor: colors.medium,
              border: '1px solid var(--surface-border)'
            }} />
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 2,
              backgroundColor: colors.dark,
              border: '1px solid var(--surface-border)'
            }} />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
