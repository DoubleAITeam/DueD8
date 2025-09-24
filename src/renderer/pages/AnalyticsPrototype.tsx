import React, { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import AnalyticsCard from '../components/analytics/AnalyticsCard';
import SubmissionPatternsChart from '../components/analytics/SubmissionPatternsChart';
import EngagementHeatmap from '../components/analytics/EngagementHeatmap';
import StudyTimeInsights from '../components/analytics/StudyTimeInsights';
import PerformancePredictions from '../components/analytics/PerformancePredictions';
import WorkloadBalance from '../components/analytics/WorkloadBalance';
import AchievementBadges from '../components/analytics/AchievementBadges';
import PeerBenchmarking from '../components/analytics/PeerBenchmarking';
import SyllabusProgress from '../components/analytics/SyllabusProgress';

export default function AnalyticsPrototype() {
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  // Mock data for all features
  const mockSubmissionData = {
    onTimeCount: 12,
    lateCount: 3,
    missingCount: 1
  };

  const mockEngagementData = Array.from({ length: 7 * 24 }, (_, i) => ({
    hour: i % 24,
    day: Math.floor(i / 24),
    activity: Math.floor(Math.random() * 8) + (i % 24 >= 8 && i % 24 <= 22 ? 3 : 0)
  }));

  const mockStudyTimeData = {
    data: [
      { course: 'Math 101', totalMinutes: 420, sessions: 8, avgSessionLength: 52, peakHour: 14, consistency: 85 },
      { course: 'English Lit', totalMinutes: 280, sessions: 5, avgSessionLength: 56, peakHour: 19, consistency: 72 },
      { course: 'Chemistry', totalMinutes: 340, sessions: 6, avgSessionLength: 57, peakHour: 16, consistency: 90 },
      { course: 'History', totalMinutes: 180, sessions: 4, avgSessionLength: 45, peakHour: 20, consistency: 65 }
    ],
    totalStudyTime: 1220,
    peakStudyTime: { hour: 14, day: 'Tuesday' },
    consistencyScore: 78
  };

  const mockPredictions = {
    predictions: [
      {
        course: 'Math 101',
        currentGrade: 82,
        projectedGrade: 85,
        confidence: 87,
        trend: 'improving' as const,
        riskLevel: 'low' as const,
        recommendation: 'Keep up current study pace. Focus on upcoming midterm.'
      },
      {
        course: 'English Lit',
        currentGrade: 76,
        projectedGrade: 73,
        confidence: 72,
        trend: 'declining' as const,
        riskLevel: 'medium' as const,
        recommendation: 'Submit next essay early for feedback. Consider study group.'
      },
      {
        course: 'Chemistry',
        currentGrade: 88,
        projectedGrade: 90,
        confidence: 93,
        trend: 'improving' as const,
        riskLevel: 'low' as const,
        recommendation: 'Excellent trajectory! Maintain lab attendance.'
      }
    ],
    overallGPA: {
      current: 3.24,
      projected: 3.31,
      trend: [
        { month: 'Sep', gpa: 3.1 },
        { month: 'Oct', gpa: 3.15 },
        { month: 'Nov', gpa: 3.2 },
        { month: 'Dec', gpa: 3.24 },
        { month: 'Jan', gpa: 3.28 },
        { month: 'Feb', gpa: 3.31 }
      ]
    }
  };

  const mockWorkloadData = {
    workloadData: [
      { course: 'Math 101', hoursPerWeek: 8, assignmentsThisWeek: 2, upcomingDeadlines: 3, stressLevel: 'medium' as const },
      { course: 'English Lit', hoursPerWeek: 6, assignmentsThisWeek: 1, upcomingDeadlines: 2, stressLevel: 'low' as const },
      { course: 'Chemistry', hoursPerWeek: 10, assignmentsThisWeek: 3, upcomingDeadlines: 4, stressLevel: 'high' as const },
      { course: 'History', hoursPerWeek: 4, assignmentsThisWeek: 1, upcomingDeadlines: 1, stressLevel: 'low' as const }
    ],
    deadlineClusters: [
      {
        date: '2024-02-15',
        assignments: [
          { name: 'Calculus Problem Set 5', course: 'Math 101', priority: 'high' as const },
          { name: 'Lab Report #3', course: 'Chemistry', priority: 'medium' as const },
          { name: 'Essay Draft', course: 'English Lit', priority: 'low' as const }
        ]
      }
    ],
    totalHours: 28,
    stressScore: 65
  };

  const mockAchievements = {
    achievements: [
      {
        id: '1',
        title: 'Early Bird',
        description: 'Submit 5 assignments early',
        icon: '🐦',
        category: 'consistency' as const,
        earned: true,
        earnedDate: '2024-01-15',
        rarity: 'common' as const
      },
      {
        id: '2',
        title: 'Perfect Week',
        description: 'Complete all assignments in one week',
        icon: '⭐',
        category: 'performance' as const,
        earned: true,
        earnedDate: '2024-01-22',
        rarity: 'rare' as const
      },
      {
        id: '3',
        title: 'Study Streak',
        description: 'Study for 7 consecutive days',
        icon: '🔥',
        category: 'consistency' as const,
        earned: false,
        progress: 71,
        rarity: 'epic' as const
      },
      {
        id: '4',
        title: 'Grade Improver',
        description: 'Improve grade by 10% in one month',
        icon: '📈',
        category: 'improvement' as const,
        earned: false,
        progress: 0,
        rarity: 'legendary' as const
      }
    ],
    recentAchievements: [
      {
        id: '2',
        title: 'Perfect Week',
        description: 'Complete all assignments in one week',
        icon: '⭐',
        category: 'performance' as const,
        earned: true,
        earnedDate: '2024-01-22',
        rarity: 'rare' as const
      }
    ],
    totalPoints: 1250,
    nextMilestone: { points: 1500, reward: 'Study Master Badge' }
  };

  const mockBenchmarking = {
    benchmarks: [
      {
        metric: 'Study Hours/Week',
        userValue: 28,
        classAverage: 22,
        classMedian: 20,
        userPercentile: 78,
        unit: 'h',
        category: 'engagement' as const
      },
      {
        metric: 'Assignment Timeliness',
        userValue: 85,
        classAverage: 72,
        classMedian: 70,
        userPercentile: 82,
        unit: '%',
        category: 'timeliness' as const
      },
      {
        metric: 'Course Engagement',
        userValue: 94,
        classAverage: 76,
        classMedian: 74,
        userPercentile: 89,
        unit: '%',
        category: 'engagement' as const
      }
    ],
    overallRanking: {
      percentile: 83,
      totalStudents: 127,
      category: 'Overall Performance'
    },
    strengths: [
      'Consistent study schedule',
      'High engagement in discussions',
      'Early assignment submissions',
      'Above-average study time'
    ],
    improvementAreas: [
      'Focus on Chemistry lab reports',
      'Participate more in English discussions',
      'Review Math concepts more frequently'
    ]
  };

  const mockSyllabusProgress = {
    modules: [
      {
        id: '1',
        title: 'Introduction to Calculus',
        week: 1,
        objectives: [
          { id: '1a', title: 'Understand limits', description: 'Basic limit concepts', completed: true, progress: 100, relatedAssignments: [], difficulty: 'beginner' as const, prerequisites: [] },
          { id: '1b', title: 'Derivative basics', description: 'Introduction to derivatives', completed: true, progress: 100, relatedAssignments: [], difficulty: 'beginner' as const, prerequisites: [] }
        ],
        isCurrentWeek: false,
        completed: true
      },
      {
        id: '2',
        title: 'Advanced Derivatives',
        week: 2,
        objectives: [
          { id: '2a', title: 'Chain rule', description: 'Master the chain rule', completed: true, progress: 100, relatedAssignments: [], difficulty: 'intermediate' as const, prerequisites: [] },
          { id: '2b', title: 'Product rule', description: 'Apply product rule', completed: false, progress: 60, relatedAssignments: [], difficulty: 'intermediate' as const, prerequisites: [] }
        ],
        isCurrentWeek: true,
        completed: false
      },
      {
        id: '3',
        title: 'Integration Techniques',
        week: 3,
        objectives: [
          { id: '3a', title: 'Basic integration', description: 'Fundamental integration', completed: false, progress: 0, relatedAssignments: [], difficulty: 'advanced' as const, prerequisites: [] },
          { id: '3b', title: 'Integration by parts', description: 'Advanced integration', completed: false, progress: 0, relatedAssignments: [], difficulty: 'advanced' as const, prerequisites: [] }
        ],
        isCurrentWeek: false,
        completed: false
      }
    ],
    overallProgress: 67,
    currentWeek: 2,
    totalWeeks: 16,
    upcomingMilestones: [
      { week: 4, title: 'First Midterm Exam', type: 'exam' as const },
      { week: 6, title: 'Calculus Project', type: 'project' as const }
    ]
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview', count: 4 },
    { id: 'submissions', label: '⏰ Submission Patterns', count: 1 },
    { id: 'engagement', label: '📚 Engagement', count: 1 },
    { id: 'study-time', label: '⏱️ Study Time', count: 1 },
    { id: 'predictions', label: '🔮 Predictions', count: 1 },
    { id: 'workload', label: '⚖️ Workload', count: 1 },
    { id: 'achievements', label: '🏆 Achievements', count: 1 },
    { id: 'benchmarking', label: '📈 Peer Comparison', count: 1 },
    { id: 'syllabus', label: '📋 Syllabus Progress', count: 1 }
  ];

  return (
    <AppShell pageTitle="Analytics Prototype">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
                🚀 Analytics Prototype
              </h1>
              <p style={{ 
                margin: '8px 0 0 0', 
                color: 'var(--text-secondary)',
                fontSize: 16
              }}>
                Explore all the creative analytics features with realistic mock data
              </p>
            </div>
            
            <div style={{ 
              padding: '8px 16px',
              backgroundColor: 'rgba(109, 40, 217, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(109, 40, 217, 0.3)',
              color: 'var(--primary)',
              fontSize: 14,
              fontWeight: 600
            }}>
              🧪 Prototype Mode
            </div>
          </div>

          {/* Tab navigation */}
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            overflowX: 'auto',
            paddingBottom: 8,
            borderBottom: '1px solid var(--surface-border)'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: selectedTab === tab.id ? 'var(--primary)' : 'transparent',
                  color: selectedTab === tab.id ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                {tab.count > 1 && (
                  <span style={{ 
                    marginLeft: 8,
                    fontSize: 11,
                    opacity: 0.8
                  }}>
                    ({tab.count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content based on selected tab */}
        {selectedTab === 'overview' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 24
          }}>
            <AnalyticsCard title="🎯 Performance Predictions">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
                  3.24 → 3.31 GPA
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Projected improvement with current trajectory
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="⚖️ Workload Balance">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)', marginBottom: 8 }}>
                  65/100 Stress
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Moderate workload - manageable with planning
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="🏆 Achievement Progress">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
                  1,250 XP
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  2 of 4 achievements unlocked
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="📈 Peer Ranking">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
                  Top 20%
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Better than 83% of students
                </div>
              </div>
            </AnalyticsCard>
          </div>
        )}

        {selectedTab === 'submissions' && (
          <AnalyticsCard title="⏰ Assignment Submission Patterns">
            <SubmissionPatternsChart {...mockSubmissionData} />
          </AnalyticsCard>
        )}

        {selectedTab === 'engagement' && (
          <AnalyticsCard title="📚 Course Engagement Heatmap">
            <EngagementHeatmap 
              data={mockEngagementData}
              title="Weekly Activity Pattern"
            />
          </AnalyticsCard>
        )}

        {selectedTab === 'study-time' && (
          <AnalyticsCard title="⏱️ Study Time Intelligence">
            <StudyTimeInsights {...mockStudyTimeData} />
          </AnalyticsCard>
        )}

        {selectedTab === 'predictions' && (
          <AnalyticsCard title="🔮 Performance Predictions">
            <PerformancePredictions {...mockPredictions} />
          </AnalyticsCard>
        )}

        {selectedTab === 'workload' && (
          <AnalyticsCard title="⚖️ Workload Balance Analysis">
            <WorkloadBalance {...mockWorkloadData} />
          </AnalyticsCard>
        )}

        {selectedTab === 'achievements' && (
          <AnalyticsCard title="🏆 Achievement System">
            <AchievementBadges {...mockAchievements} />
          </AnalyticsCard>
        )}

        {selectedTab === 'benchmarking' && (
          <AnalyticsCard title="📈 Peer Benchmarking">
            <PeerBenchmarking {...mockBenchmarking} />
          </AnalyticsCard>
        )}

        {selectedTab === 'syllabus' && (
          <AnalyticsCard title="📋 Syllabus Progress Tracking">
            <SyllabusProgress {...mockSyllabusProgress} />
          </AnalyticsCard>
        )}

        {/* Prototype disclaimer */}
        <div style={{ 
          padding: 20,
          borderRadius: 16,
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '2px solid rgba(59, 130, 246, 0.2)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--info)' }}>
            🧪 This is a Prototype
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            All data shown is realistic mock data for demonstration purposes. 
            Select which features you'd like me to implement with real Canvas data!
          </div>
        </div>
      </div>
    </AppShell>
  );
}
