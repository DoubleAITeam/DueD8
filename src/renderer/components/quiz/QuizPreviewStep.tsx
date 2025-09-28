import React from 'react';
import { useQuizCreation } from '../../state/quiz';
import { CheckIcon, PlayIcon, SaveIcon, EditIcon } from '../icons';
import QuestionPreview from './QuestionPreview';

interface QuizPreviewStepProps {
  onSave: () => void;
}

export default function QuizPreviewStep({ onSave }: QuizPreviewStepProps) {
  const { currentQuiz, currentQuestions, setCreationStep } = useQuizCreation();

  const handlePrevious = () => {
    setCreationStep('settings');
  };

  const handleTest = () => {
    // This would open the quiz in test mode
    console.log('Test quiz functionality');
  };

  // Calculate quiz statistics
  const stats = {
    totalQuestions: currentQuestions.length,
    totalPoints: currentQuestions.reduce((sum, q) => sum + q.points, 0),
    estimatedTime: currentQuiz?.settings?.timeLimit || 
      Math.ceil(currentQuestions.reduce((sum, q) => sum + (q.timeLimit || 60), 0) / 60),
    difficultyBreakdown: currentQuestions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    typeBreakdown: currentQuestions.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return (
    <div className="quiz-preview">
      <div className="quiz-preview__header">
        <h2>Quiz Preview</h2>
        <p>Review your quiz before saving</p>
      </div>

      <div className="quiz-preview__content">
        {/* Quiz Overview */}
        <div className="quiz-overview">
          <div className="quiz-overview__main">
            <h3>{currentQuiz?.title || 'Untitled Quiz'}</h3>
            {currentQuiz?.description && (
              <p className="quiz-description">{currentQuiz.description}</p>
            )}
            
            <div className="quiz-meta">
              <div className="quiz-mode-badge quiz-mode-badge--{currentQuiz?.settings?.mode}">
                {currentQuiz?.settings?.mode?.replace('-', ' ').toUpperCase()}
              </div>
              {currentQuiz?.courseId && (
                <div className="course-badge">
                  Course Quiz
                </div>
              )}
            </div>
          </div>

          <div className="quiz-overview__stats">
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.totalQuestions}</span>
                <span className="stat-label">Questions</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.totalPoints}</span>
                <span className="stat-label">Points</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.estimatedTime}</span>
                <span className="stat-label">Minutes</span>
              </div>
            </div>

            <div className="difficulty-breakdown">
              <h4>Difficulty Distribution</h4>
              <div className="difficulty-bars">
                {Object.entries(stats.difficultyBreakdown).map(([difficulty, count]) => (
                  <div key={difficulty} className="difficulty-bar">
                    <span className="difficulty-label">{difficulty}</span>
                    <div className="difficulty-bar__track">
                      <div 
                        className={`difficulty-bar__fill difficulty-bar__fill--${difficulty}`}
                        style={{ width: `${(count / stats.totalQuestions) * 100}%` }}
                      />
                    </div>
                    <span className="difficulty-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="question-types">
              <h4>Question Types</h4>
              <div className="type-list">
                {Object.entries(stats.typeBreakdown).map(([type, count]) => (
                  <div key={type} className="type-item">
                    <span className="type-name">
                      {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="type-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Settings Summary */}
        <div className="settings-summary">
          <h4>Quiz Settings</h4>
          <div className="settings-grid">
            <div className="setting-item">
              <span className="setting-label">Time Limit:</span>
              <span className="setting-value">
                {currentQuiz?.settings?.timeLimit ? 
                  `${currentQuiz.settings.timeLimit} minutes` : 
                  'No limit'
                }
              </span>
            </div>
            
            <div className="setting-item">
              <span className="setting-label">Feedback:</span>
              <span className="setting-value">
                {currentQuiz?.settings?.showFeedback?.replace('-', ' ') || 'After submission'}
              </span>
            </div>
            
            <div className="setting-item">
              <span className="setting-label">Retakes:</span>
              <span className="setting-value">
                {currentQuiz?.settings?.allowRetake ? 
                  `Up to ${currentQuiz.settings.maxAttempts} attempts` : 
                  'Not allowed'
                }
              </span>
            </div>
            
            <div className="setting-item">
              <span className="setting-label">Question Order:</span>
              <span className="setting-value">
                {currentQuiz?.settings?.shuffleQuestions ? 'Shuffled' : 'Fixed'}
              </span>
            </div>
          </div>
        </div>

        {/* Questions Preview */}
        <div className="questions-preview">
          <div className="questions-preview__header">
            <h4>Questions ({currentQuestions.length})</h4>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setCreationStep('questions')}
            >
              <EditIcon size={14} />
              Edit Questions
            </button>
          </div>

          <div className="questions-preview__list">
            {currentQuestions.map((question, index) => (
              <div key={question.id} className="question-preview-card">
                <div className="question-preview-card__header">
                  <span className="question-number">Q{index + 1}</span>
                  <div className="question-meta">
                    <span className={`difficulty-badge difficulty-badge--${question.difficulty}`}>
                      {question.difficulty}
                    </span>
                    <span className="question-points">{question.points} pts</span>
                    <span className="question-type">
                      {question.type.replace('-', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="question-preview-card__content">
                  <h5>{question.question || 'Untitled Question'}</h5>
                  
                  {/* Quick preview based on question type */}
                  {question.type === 'multiple-choice' && (
                    <div className="quick-preview">
                      <span className="option-count">
                        {(question as any).options?.length || 0} options
                      </span>
                    </div>
                  )}
                  
                  {question.type === 'true-false' && (
                    <div className="quick-preview">
                      <span className="correct-answer">
                        Answer: {(question as any).correctAnswer ? 'True' : 'False'}
                      </span>
                    </div>
                  )}
                  
                  {question.explanation && (
                    <div className="explanation-preview">
                      <strong>Explanation:</strong> 
                      {question.explanation.length > 100 ? 
                        `${question.explanation.substring(0, 100)}...` : 
                        question.explanation
                      }
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="quiz-preview__actions">
        <div className="quiz-preview__progress">
          Step 4 of 4 • Ready to save
        </div>
        
        <div className="quiz-preview__buttons">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handlePrevious}
          >
            Previous
          </button>
          
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleTest}
          >
            <PlayIcon size={16} />
            Test Quiz
          </button>
          
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSave}
          >
            <SaveIcon size={16} />
            Save Quiz
          </button>
        </div>
      </div>

      {/* Success Indicators */}
      <div className="quiz-preview__checklist">
        <h4>Pre-Save Checklist</h4>
        <div className="checklist">
          <div className={`checklist-item ${currentQuiz?.title ? 'complete' : ''}`}>
            <CheckIcon size={16} />
            <span>Quiz has a title</span>
          </div>
          <div className={`checklist-item ${currentQuestions.length > 0 ? 'complete' : ''}`}>
            <CheckIcon size={16} />
            <span>At least one question added</span>
          </div>
          <div className={`checklist-item ${currentQuestions.every(q => q.question.trim()) ? 'complete' : ''}`}>
            <CheckIcon size={16} />
            <span>All questions have content</span>
          </div>
          <div className={`checklist-item ${currentQuiz?.settings ? 'complete' : ''}`}>
            <CheckIcon size={16} />
            <span>Settings configured</span>
          </div>
        </div>
      </div>
    </div>
  );
}




