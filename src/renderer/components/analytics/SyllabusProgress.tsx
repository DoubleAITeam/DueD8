import React from 'react';

type LearningObjective = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  progress: number; // 0-100
  relatedAssignments: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
};

type CourseModule = {
  id: string;
  title: string;
  week: number;
  objectives: LearningObjective[];
  isCurrentWeek: boolean;
  completed: boolean;
};

type SyllabusProgressProps = {
  modules: CourseModule[];
  overallProgress: number;
  currentWeek: number;
  totalWeeks: number;
  upcomingMilestones: Array<{
    week: number;
    title: string;
    type: 'exam' | 'project' | 'assignment';
  }>;
};

export default function SyllabusProgress({ 
  modules, 
  overallProgress, 
  currentWeek, 
  totalWeeks, 
  upcomingMilestones 
}: SyllabusProgressProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'var(--success)';
      case 'intermediate': return 'var(--warning)';
      case 'advanced': return 'var(--error)';
      default: return 'var(--text-secondary)';
    }
  };

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case 'exam': return '📝';
      case 'project': return '🚀';
      case 'assignment': return '📋';
      default: return '📌';
    }
  };

  const completedObjectives = modules.reduce((total, module) => 
    total + module.objectives.filter(obj => obj.completed).length, 0
  );
  const totalObjectives = modules.reduce((total, module) => 
    total + module.objectives.length, 0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overall progress */}
      <div style={{ 
        padding: 20,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              Week {currentWeek} of {totalWeeks}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              {completedObjectives} of {totalObjectives} objectives mastered
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {overallProgress}%
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Course Progress
            </div>
          </div>
        </div>
        
        <div style={{ 
          height: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 4,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${overallProgress}%`,
            height: '100%',
            backgroundColor: 'white',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Upcoming milestones */}
      {upcomingMilestones.length > 0 && (
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            🎯 Upcoming Milestones
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingMilestones.map((milestone, index) => (
              <div key={index} style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                backgroundColor: milestone.week === currentWeek + 1 ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-card)'
              }}>
                <span style={{ fontSize: 20 }}>
                  {getMilestoneIcon(milestone.type)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {milestone.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Week {milestone.week} • {milestone.type}
                  </div>
                </div>
                {milestone.week === currentWeek + 1 && (
                  <div style={{ 
                    fontSize: 10,
                    padding: '4px 8px',
                    borderRadius: 999,
                    backgroundColor: 'var(--warning)',
                    color: 'white',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}>
                    Next Week
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module breakdown */}
      <div>
        <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          📚 Course Modules
        </h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {modules.map((module) => {
            const moduleProgress = module.objectives.length > 0 
              ? (module.objectives.filter(obj => obj.completed).length / module.objectives.length) * 100 
              : 0;

            return (
              <div key={module.id} style={{ 
                padding: 16,
                borderRadius: 12,
                border: module.isCurrentWeek ? '2px solid var(--primary)' : '1px solid var(--surface-border)',
                backgroundColor: module.isCurrentWeek ? 'rgba(109, 40, 217, 0.05)' : 'var(--surface-card)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      marginBottom: 4
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        Week {module.week}: {module.title}
                      </span>
                      {module.isCurrentWeek && (
                        <span style={{ 
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 999,
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          Current
                        </span>
                      )}
                      {module.completed && (
                        <span style={{ fontSize: 16 }}>✅</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {module.objectives.filter(obj => obj.completed).length} of {module.objectives.length} objectives completed
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: 18, 
                      fontWeight: 700,
                      color: moduleProgress === 100 ? 'var(--success)' : 'var(--primary)'
                    }}>
                      {moduleProgress.toFixed(0)}%
                    </div>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div style={{ 
                  height: 6,
                  backgroundColor: 'var(--surface-border)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 12
                }}>
                  <div style={{
                    width: `${moduleProgress}%`,
                    height: '100%',
                    backgroundColor: moduleProgress === 100 ? 'var(--success)' : 'var(--primary)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Learning objectives */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {module.objectives.map((objective) => (
                    <div key={objective.id} style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 8,
                      borderRadius: 6,
                      backgroundColor: objective.completed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0, 0, 0, 0.02)'
                    }}>
                      <div style={{ 
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: objective.completed ? 'var(--success)' : 'var(--surface-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: 'white',
                        flexShrink: 0
                      }}>
                        {objective.completed ? '✓' : ''}
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: 13, 
                          fontWeight: 500,
                          textDecoration: objective.completed ? 'line-through' : 'none',
                          opacity: objective.completed ? 0.7 : 1
                        }}>
                          {objective.title}
                        </div>
                        {objective.description && (
                          <div style={{ 
                            fontSize: 11, 
                            color: 'var(--text-secondary)',
                            marginTop: 2
                          }}>
                            {objective.description}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ 
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 999,
                        backgroundColor: getDifficultyColor(objective.difficulty),
                        color: 'white',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}>
                        {objective.difficulty}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
