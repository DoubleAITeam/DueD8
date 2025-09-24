import React from 'react';
import BarChart from './BarChart';

type StudySession = {
  course: string;
  totalMinutes: number;
  sessions: number;
  avgSessionLength: number;
  peakHour: number;
  consistency: number; // 0-100 score
};

type StudyTimeInsightsProps = {
  data: StudySession[];
  totalStudyTime: number;
  peakStudyTime: { hour: number; day: string };
  consistencyScore: number;
};

export default function StudyTimeInsights({ 
  data, 
  totalStudyTime, 
  peakStudyTime, 
  consistencyScore 
}: StudyTimeInsightsProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  const chartData = data.map(session => ({
    label: session.course,
    value: session.totalMinutes,
    color: session.totalMinutes > 300 ? 'var(--success)' : 
           session.totalMinutes > 120 ? 'var(--info)' : 'var(--warning)'
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key insights */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 16
      }}>
        <div style={{ 
          padding: 16,
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderRadius: 12,
          border: '1px solid rgba(59, 130, 246, 0.2)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--info)' }}>
            {formatTime(totalStudyTime)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Total this week
          </div>
        </div>

        <div style={{ 
          padding: 16,
          backgroundColor: 'rgba(168, 85, 247, 0.08)',
          borderRadius: 12,
          border: '1px solid rgba(168, 85, 247, 0.2)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            {formatHour(peakStudyTime.hour)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Peak time ({peakStudyTime.day})
          </div>
        </div>

        <div style={{ 
          padding: 16,
          backgroundColor: `rgba(34, 197, 94, ${consistencyScore / 100 * 0.08})`,
          borderRadius: 12,
          border: `1px solid rgba(34, 197, 94, ${consistencyScore / 100 * 0.3})`,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
            {consistencyScore}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Consistency score
          </div>
        </div>
      </div>

      {/* Study time by course */}
      <div>
        <h5 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
          Study Time by Course
        </h5>
        <BarChart
          data={chartData}
          horizontal
          showValues
          formatValue={(value) => formatTime(value)}
          height={Math.max(150, data.length * 40)}
        />
      </div>

      {/* Session insights */}
      <div>
        <h5 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
          Session Analysis
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((session, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--surface-border)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)'
            }}>
              <div style={{ fontWeight: 500 }}>{session.course}</div>
              <div style={{ 
                display: 'flex', 
                gap: 16, 
                fontSize: 12, 
                color: 'var(--text-secondary)' 
              }}>
                <span>{session.sessions} sessions</span>
                <span>Avg: {formatTime(session.avgSessionLength)}</span>
                <span>Peak: {formatHour(session.peakHour)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
