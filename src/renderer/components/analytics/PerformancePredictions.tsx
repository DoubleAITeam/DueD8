import React from 'react';
import LineChart from './LineChart';

type GradePrediction = {
  course: string;
  currentGrade: number;
  projectedGrade: number;
  confidence: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
};

type PerformancePredictionsProps = {
  predictions: GradePrediction[];
  overallGPA: {
    current: number;
    projected: number;
    trend: Array<{ month: string; gpa: number }>;
  };
};

export default function PerformancePredictions({ predictions, overallGPA }: PerformancePredictionsProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'var(--error)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-secondary)';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overall GPA Prediction */}
      <div style={{ 
        padding: 20,
        borderRadius: 16,
        border: '1px solid var(--surface-border)',
        backgroundColor: 'rgba(109, 40, 217, 0.05)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            GPA Projection
          </h4>
          <div style={{ 
            display: 'flex', 
            gap: 16,
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Current</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {overallGPA.current.toFixed(2)}
              </div>
            </div>
            <div style={{ fontSize: 20 }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Projected</div>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 700, 
                color: overallGPA.projected > overallGPA.current ? 'var(--success)' : 'var(--error)'
              }}>
                {overallGPA.projected.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        
        <LineChart
          data={overallGPA.trend.map(point => ({
            label: point.month,
            value: point.gpa * 25 // Convert to percentage scale for chart
          }))}
          formatValue={(value) => (value / 25).toFixed(2)}
          color="var(--primary)"
          height={120}
        />
      </div>

      {/* Course Predictions */}
      <div>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Course Performance Predictions
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {predictions.map((prediction, index) => (
            <div key={index} style={{ 
              padding: 16,
              borderRadius: 12,
              border: `2px solid ${getRiskColor(prediction.riskLevel)}20`,
              backgroundColor: `${getRiskColor(prediction.riskLevel)}08`
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: 8
              }}>
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    marginBottom: 4
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {prediction.course}
                    </span>
                    <span style={{ fontSize: 16 }}>
                      {getTrendIcon(prediction.trend)}
                    </span>
                    <span style={{ 
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: getRiskColor(prediction.riskLevel),
                      color: 'white',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}>
                      {prediction.riskLevel} risk
                    </span>
                  </div>
                  
                  <div style={{ 
                    fontSize: 13, 
                    color: 'var(--text-secondary)',
                    marginBottom: 8
                  }}>
                    {prediction.recommendation}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Current → Projected
                  </div>
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700,
                    color: prediction.projectedGrade > prediction.currentGrade ? 'var(--success)' : 'var(--error)'
                  }}>
                    {prediction.currentGrade.toFixed(1)}% → {prediction.projectedGrade.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {prediction.confidence}% confidence
                  </div>
                </div>
              </div>
              
              {/* Progress bar showing projection */}
              <div style={{ 
                height: 6,
                backgroundColor: 'var(--surface-border)',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${prediction.currentGrade}%`,
                  height: '100%',
                  backgroundColor: 'var(--text-secondary)',
                  position: 'absolute',
                  left: 0
                }} />
                <div style={{
                  width: `${Math.abs(prediction.projectedGrade - prediction.currentGrade)}%`,
                  height: '100%',
                  backgroundColor: prediction.projectedGrade > prediction.currentGrade ? 'var(--success)' : 'var(--error)',
                  position: 'absolute',
                  left: `${Math.min(prediction.currentGrade, prediction.projectedGrade)}%`,
                  opacity: 0.7
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
