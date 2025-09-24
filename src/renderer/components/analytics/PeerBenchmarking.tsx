import React from 'react';
import BarChart from './BarChart';

type BenchmarkData = {
  metric: string;
  userValue: number;
  classAverage: number;
  classMedian: number;
  userPercentile: number; // 0-100
  unit: string;
  category: 'engagement' | 'performance' | 'timeliness';
};

type PeerBenchmarkingProps = {
  benchmarks: BenchmarkData[];
  overallRanking: {
    percentile: number;
    totalStudents: number;
    category: string;
  };
  strengths: string[];
  improvementAreas: string[];
};

export default function PeerBenchmarking({ 
  benchmarks, 
  overallRanking, 
  strengths, 
  improvementAreas 
}: PeerBenchmarkingProps) {
  const getPercentileColor = (percentile: number) => {
    if (percentile >= 80) return 'var(--success)';
    if (percentile >= 60) return 'var(--info)';
    if (percentile >= 40) return 'var(--warning)';
    return 'var(--error)';
  };

  const getPercentileLabel = (percentile: number) => {
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Above Average';
    if (percentile >= 25) return 'Below Average';
    return 'Bottom 25%';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'engagement': return '📚';
      case 'performance': return '🎯';
      case 'timeliness': return '⏰';
      default: return '📊';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overall ranking */}
      <div style={{ 
        padding: 24,
        borderRadius: 16,
        background: `linear-gradient(135deg, ${getPercentileColor(overallRanking.percentile)}20, ${getPercentileColor(overallRanking.percentile)}10)`,
        border: `2px solid ${getPercentileColor(overallRanking.percentile)}30`,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: getPercentileColor(overallRanking.percentile), marginBottom: 8 }}>
          {getPercentileLabel(overallRanking.percentile)}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          Overall Class Ranking
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          You're performing better than {overallRanking.percentile}% of students
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Based on {overallRanking.category} • {overallRanking.totalStudents} students
        </div>
      </div>

      {/* Benchmark comparisons */}
      <div>
        <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          📊 Performance Comparison
        </h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {benchmarks.map((benchmark, index) => {
            const comparisonData = [
              {
                label: 'You',
                value: benchmark.userValue,
                color: getPercentileColor(benchmark.userPercentile)
              },
              {
                label: 'Class Average',
                value: benchmark.classAverage,
                color: 'var(--text-secondary)'
              },
              {
                label: 'Class Median',
                value: benchmark.classMedian,
                color: 'var(--muted)'
              }
            ];

            return (
              <div key={index} style={{ 
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--surface-border)',
                backgroundColor: 'var(--surface-card)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>
                      {getCategoryIcon(benchmark.category)}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {benchmark.metric}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {getPercentileLabel(benchmark.userPercentile)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: 16, 
                      fontWeight: 700,
                      color: getPercentileColor(benchmark.userPercentile)
                    }}>
                      {benchmark.userValue}{benchmark.unit}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {benchmark.userPercentile}th percentile
                    </div>
                  </div>
                </div>
                
                <BarChart
                  data={comparisonData}
                  showValues
                  formatValue={(value) => `${value}${benchmark.unit}`}
                  height={80}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 20
      }}>
        {/* Strengths */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>
            💪 Your Strengths
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {strengths.map((strength, index) => (
              <div key={index} style={{ 
                padding: 12,
                borderRadius: 8,
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 14 }}>{strength}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement areas */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--warning)' }}>
            🎯 Growth Opportunities
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {improvementAreas.map((area, index) => (
              <div key={index} style={{ 
                padding: 12,
                borderRadius: 8,
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span style={{ fontSize: 14 }}>{area}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy note */}
      <div style={{ 
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        fontSize: 12,
        color: 'var(--text-secondary)',
        textAlign: 'center'
      }}>
        🔒 All comparisons are anonymous. Individual student data is never shared or identifiable.
      </div>
    </div>
  );
}
