import React from 'react';
import PieChart from './PieChart';
import BarChart from './BarChart';

type WorkloadData = {
  course: string;
  hoursPerWeek: number;
  assignmentsThisWeek: number;
  upcomingDeadlines: number;
  stressLevel: 'low' | 'medium' | 'high';
};

type DeadlineCluster = {
  date: string;
  assignments: Array<{ name: string; course: string; priority: 'low' | 'medium' | 'high' }>;
};

type WorkloadBalanceProps = {
  workloadData: WorkloadData[];
  deadlineClusters: DeadlineCluster[];
  totalHours: number;
  stressScore: number; // 0-100
};

export default function WorkloadBalance({ 
  workloadData, 
  deadlineClusters, 
  totalHours, 
  stressScore 
}: WorkloadBalanceProps) {
  const getStressColor = (level: string) => {
    switch (level) {
      case 'high': return 'var(--error)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-secondary)';
    }
  };

  const pieChartData = workloadData.map(item => ({
    label: item.course,
    value: item.hoursPerWeek,
    color: getStressColor(item.stressLevel)
  }));

  const stressBarData = workloadData.map(item => ({
    label: item.course,
    value: item.assignmentsThisWeek + item.upcomingDeadlines,
    color: getStressColor(item.stressLevel)
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overall stress indicator */}
      <div style={{ 
        padding: 20,
        borderRadius: 16,
        border: `2px solid ${stressScore > 70 ? 'var(--error)' : stressScore > 40 ? 'var(--warning)' : 'var(--success)'}30`,
        backgroundColor: `${stressScore > 70 ? 'var(--error)' : stressScore > 40 ? 'var(--warning)' : 'var(--success)'}08`,
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: 32, 
          fontWeight: 700, 
          color: stressScore > 70 ? 'var(--error)' : stressScore > 40 ? 'var(--warning)' : 'var(--success)',
          marginBottom: 8
        }}>
          {stressScore}/100
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          Workload Stress Level
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {stressScore > 70 ? '⚠️ High stress - consider redistributing workload' :
           stressScore > 40 ? '⚡ Moderate stress - manageable with good planning' :
           '✅ Low stress - good balance maintained'}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24
      }}>
        {/* Time distribution */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
            Weekly Time Distribution ({totalHours}h total)
          </h5>
          <PieChart
            data={pieChartData}
            size={200}
            formatValue={(value) => `${value}h`}
          />
        </div>

        {/* Assignment load */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
            Assignment Load (This Week + Upcoming)
          </h5>
          <BarChart
            data={stressBarData}
            showValues
            formatValue={(value) => `${value} tasks`}
            height={200}
          />
        </div>
      </div>

      {/* Deadline clusters */}
      <div>
        <h5 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
          Deadline Clusters
        </h5>
        
        {deadlineClusters.length === 0 ? (
          <div style={{ 
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--surface-card)',
            borderRadius: 12,
            border: '1px solid var(--surface-border)'
          }}>
            No deadline clusters detected - good spacing! 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deadlineClusters.map((cluster, index) => (
              <div key={index} style={{ 
                padding: 16,
                borderRadius: 12,
                border: '2px solid var(--error)30',
                backgroundColor: 'var(--error)08'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {new Date(cluster.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {cluster.assignments.length} assignment{cluster.assignments.length !== 1 ? 's' : ''} due
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 24,
                    color: 'var(--error)'
                  }}>
                    ⚠️
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cluster.assignments.map((assignment, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '6px 0'
                    }}>
                      <span>{assignment.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {assignment.course}
                        </span>
                        <span style={{ 
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 999,
                          backgroundColor: assignment.priority === 'high' ? 'var(--error)' :
                                          assignment.priority === 'medium' ? 'var(--warning)' : 'var(--success)',
                          color: 'white',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          {assignment.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Course breakdown */}
      <div>
        <h5 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>
          Course Workload Breakdown
        </h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workloadData.map((course, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${getStressColor(course.stressLevel)}30`,
              backgroundColor: `${getStressColor(course.stressLevel)}08`
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{course.course}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {course.hoursPerWeek}h/week • {course.assignmentsThisWeek} this week • {course.upcomingDeadlines} upcoming
                </div>
              </div>
              <div style={{ 
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 999,
                backgroundColor: getStressColor(course.stressLevel),
                color: 'white',
                textTransform: 'uppercase',
                fontWeight: 600
              }}>
                {course.stressLevel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
