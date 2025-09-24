import React from 'react';

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'consistency' | 'performance' | 'improvement' | 'milestone';
  earned: boolean;
  earnedDate?: string;
  progress?: number; // 0-100 for partially earned badges
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
};

type AchievementBadgesProps = {
  achievements: Achievement[];
  recentAchievements: Achievement[];
  totalPoints: number;
  nextMilestone: { points: number; reward: string };
};

export default function AchievementBadges({ 
  achievements, 
  recentAchievements, 
  totalPoints, 
  nextMilestone 
}: AchievementBadgesProps) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', border: '#FFD700' };
      case 'epic': return { bg: 'linear-gradient(135deg, #9333EA, #7C3AED)', border: '#9333EA' };
      case 'rare': return { bg: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', border: '#3B82F6' };
      case 'common': return { bg: 'linear-gradient(135deg, #10B981, #059669)', border: '#10B981' };
      default: return { bg: '#E5E7EB', border: '#D1D5DB' };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consistency': return '🎯';
      case 'performance': return '🏆';
      case 'improvement': return '📈';
      case 'milestone': return '🎉';
      default: return '⭐';
    }
  };

  const earnedAchievements = achievements.filter(a => a.earned);
  const inProgressAchievements = achievements.filter(a => !a.earned && a.progress && a.progress > 0);
  const lockedAchievements = achievements.filter(a => !a.earned && (!a.progress || a.progress === 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Progress overview */}
      <div style={{ 
        padding: 20,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          {totalPoints} XP
        </div>
        <div style={{ fontSize: 16, marginBottom: 12 }}>
          {earnedAchievements.length} of {achievements.length} achievements unlocked
        </div>
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 14
        }}>
          Next: {nextMilestone.reward} at {nextMilestone.points} XP 
          ({nextMilestone.points - totalPoints} to go)
        </div>
      </div>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            🎉 Recently Earned
          </h5>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 12
          }}>
            {recentAchievements.map((achievement) => {
              const colors = getRarityColor(achievement.rarity);
              return (
                <div key={achievement.id} style={{ 
                  padding: 16,
                  borderRadius: 12,
                  background: colors.bg,
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ 
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    fontSize: 60,
                    opacity: 0.2,
                    transform: 'rotate(15deg)'
                  }}>
                    {achievement.icon}
                  </div>
                  
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      marginBottom: 8
                    }}>
                      <span style={{ fontSize: 20 }}>{achievement.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {achievement.title}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.9, textTransform: 'uppercase' }}>
                          {achievement.rarity}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      {achievement.description}
                    </div>
                    {achievement.earnedDate && (
                      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>
                        Earned {new Date(achievement.earnedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievement categories */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24
      }}>
        {/* Earned achievements */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            🏆 Unlocked ({earnedAchievements.length})
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {earnedAchievements.map((achievement) => {
              const colors = getRarityColor(achievement.rarity);
              return (
                <div key={achievement.id} style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: `2px solid ${colors.border}`,
                  backgroundColor: `${colors.border}15`
                }}>
                  <div style={{ fontSize: 24 }}>{achievement.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {achievement.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {achievement.description}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 999,
                    backgroundColor: colors.border,
                    color: 'white',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}>
                    {achievement.rarity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* In progress achievements */}
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            ⏳ In Progress ({inProgressAchievements.length})
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {inProgressAchievements.map((achievement) => (
              <div key={achievement.id} style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                backgroundColor: 'var(--surface-card)'
              }}>
                <div style={{ fontSize: 24, opacity: 0.6 }}>{achievement.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {achievement.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {achievement.description}
                  </div>
                  <div style={{ 
                    height: 4,
                    backgroundColor: 'var(--surface-border)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${achievement.progress}%`,
                      height: '100%',
                      backgroundColor: 'var(--primary)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {achievement.progress}% complete
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Locked achievements preview */}
      {lockedAchievements.length > 0 && (
        <div>
          <h5 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            🔒 Locked ({lockedAchievements.slice(0, 6).length} of {lockedAchievements.length})
          </h5>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12
          }}>
            {lockedAchievements.slice(0, 6).map((achievement) => (
              <div key={achievement.id} style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                backgroundColor: 'var(--surface-card)',
                opacity: 0.6
              }}>
                <div style={{ fontSize: 20, filter: 'grayscale(1)' }}>🔒</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    ???
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Keep progressing to unlock!
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
