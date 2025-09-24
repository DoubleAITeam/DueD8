import React from 'react';

type EngagementData = {
  hour: number;
  day: number; // 0 = Sunday
  activity: number; // 0-10 scale
};

type EngagementHeatmapProps = {
  data: EngagementData[];
  title?: string;
};

export default function EngagementHeatmap({ data, title }: EngagementHeatmapProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const maxActivity = Math.max(...data.map(d => d.activity), 1);
  
  const getActivityForTime = (day: number, hour: number) => {
    return data.find(d => d.day === day && d.hour === hour)?.activity || 0;
  };

  const getIntensityColor = (activity: number) => {
    const intensity = activity / maxActivity;
    if (intensity === 0) return 'var(--surface-border)';
    if (intensity <= 0.25) return 'rgba(59, 130, 246, 0.2)';
    if (intensity <= 0.5) return 'rgba(59, 130, 246, 0.4)';
    if (intensity <= 0.75) return 'rgba(59, 130, 246, 0.6)';
    return 'rgba(59, 130, 246, 0.8)';
  };

  return (
    <div>
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
        {/* Hour labels */}
        <div style={{ 
          display: 'flex',
          paddingLeft: 40,
          gap: 1
        }}>
          {[0, 6, 12, 18].map(hour => (
            <div key={hour} style={{ 
              width: `${100/4}%`,
              textAlign: 'center',
              fontSize: 9
            }}>
              {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Day labels */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 2,
            width: 35,
            justifyContent: 'space-around'
          }}>
            {days.map((day, index) => (
              <div key={index} style={{ 
                height: 16,
                display: 'flex',
                alignItems: 'center',
                fontSize: 9,
                textAlign: 'right'
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Activity grid */}
          <div style={{ flex: 1 }}>
            {days.map((_, dayIndex) => (
              <div key={dayIndex} style={{ 
                display: 'flex',
                gap: 1,
                marginBottom: 2
              }}>
                {hours.map(hour => {
                  const activity = getActivityForTime(dayIndex, hour);
                  return (
                    <div
                      key={hour}
                      style={{
                        width: `${100/24}%`,
                        height: 16,
                        borderRadius: 2,
                        backgroundColor: getIntensityColor(activity),
                        border: '1px solid var(--surface-border)',
                        cursor: 'pointer'
                      }}
                      title={`${days[dayIndex]} ${hour}:00 - Activity: ${activity}`}
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
          marginTop: 8,
          fontSize: 10,
          justifyContent: 'center'
        }}>
          <span>Less active</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity, index) => (
              <div key={index} style={{ 
                width: 12, 
                height: 12, 
                borderRadius: 2,
                backgroundColor: getIntensityColor(intensity * maxActivity),
                border: '1px solid var(--surface-border)'
              }} />
            ))}
          </div>
          <span>More active</span>
        </div>
      </div>
    </div>
  );
}
