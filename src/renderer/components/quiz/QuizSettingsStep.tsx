import React, { useState } from 'react';
import { useQuizCreation } from '../../state/quiz';
import { QuizMode } from '../../../shared/quiz';
import { ClockIcon, EyeIcon, RefreshIcon, ShieldIcon } from '../icons';

export default function QuizSettingsStep() {
  const { currentQuiz, updateQuizMetadata, setCreationStep } = useQuizCreation();
  
  const [settings, setSettings] = useState({
    mode: currentQuiz?.settings?.mode || 'practice' as QuizMode,
    timeLimit: currentQuiz?.settings?.timeLimit || 30,
    shuffleQuestions: currentQuiz?.settings?.shuffleQuestions || false,
    shuffleOptions: currentQuiz?.settings?.shuffleOptions || false,
    showFeedback: currentQuiz?.settings?.showFeedback || 'after-submission' as const,
    allowRetake: currentQuiz?.settings?.allowRetake || true,
    maxAttempts: currentQuiz?.settings?.maxAttempts || 3,
    passingScore: currentQuiz?.settings?.passingScore || 70,
    showCorrectAnswers: currentQuiz?.settings?.showCorrectAnswers || true,
    preventCheating: {
      fullScreen: currentQuiz?.settings?.preventCheating?.fullScreen || false,
      disableCopy: currentQuiz?.settings?.preventCheating?.disableCopy || false,
      randomizeOrder: currentQuiz?.settings?.preventCheating?.randomizeOrder || false
    }
  });

  const handleNext = () => {
    updateQuizMetadata({
      settings: {
        ...currentQuiz?.settings,
        ...settings
      }
    });
    setCreationStep('preview');
  };

  const handlePrevious = () => {
    setCreationStep('questions');
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updatePreventCheating = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      preventCheating: {
        ...prev.preventCheating,
        [key]: value
      }
    }));
  };

  return (
    <div className="quiz-settings">
      <div className="quiz-settings__header">
        <h2>Quiz Settings</h2>
        <p>Configure how students will take this quiz</p>
      </div>

      <div className="quiz-settings__form">
        {/* Timing Settings */}
        <div className="form-section">
          <div className="form-section__header">
            <ClockIcon size={20} />
            <h3>Timing</h3>
          </div>
          
          <div className="form-group">
            <label htmlFor="time-limit">Time Limit</label>
            <div className="form-input-group">
              <input
                id="time-limit"
                type="number"
                value={settings.timeLimit}
                onChange={(e) => updateSetting('timeLimit', parseInt(e.target.value) || 0)}
                min="0"
                max="300"
                className="form-input"
              />
              <span className="form-input-addon">minutes</span>
            </div>
            <p className="form-help">Set to 0 for no time limit</p>
          </div>
        </div>

        {/* Question Display */}
        <div className="form-section">
          <div className="form-section__header">
            <RefreshIcon size={20} />
            <h3>Question Display</h3>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.shuffleQuestions}
                onChange={(e) => updateSetting('shuffleQuestions', e.target.checked)}
              />
              Shuffle question order for each attempt
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.shuffleOptions}
                onChange={(e) => updateSetting('shuffleOptions', e.target.checked)}
              />
              Shuffle answer options (for multiple choice questions)
            </label>
          </div>
        </div>

        {/* Feedback Settings */}
        <div className="form-section">
          <div className="form-section__header">
            <EyeIcon size={20} />
            <h3>Feedback & Results</h3>
          </div>
          
          <div className="form-group">
            <label htmlFor="show-feedback">Show feedback</label>
            <select
              id="show-feedback"
              value={settings.showFeedback}
              onChange={(e) => updateSetting('showFeedback', e.target.value)}
              className="form-select"
            >
              <option value="immediate">Immediately after each question</option>
              <option value="after-submission">After quiz submission</option>
              <option value="never">Never show feedback</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.showCorrectAnswers}
                onChange={(e) => updateSetting('showCorrectAnswers', e.target.checked)}
              />
              Show correct answers in results
            </label>
          </div>
        </div>

        {/* Retake Settings */}
        <div className="form-section">
          <div className="form-section__header">
            <RefreshIcon size={20} />
            <h3>Retakes</h3>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.allowRetake}
                onChange={(e) => updateSetting('allowRetake', e.target.checked)}
              />
              Allow retakes
            </label>
          </div>

          {settings.allowRetake && (
            <>
              <div className="form-group">
                <label htmlFor="max-attempts">Maximum attempts</label>
                <input
                  id="max-attempts"
                  type="number"
                  value={settings.maxAttempts}
                  onChange={(e) => updateSetting('maxAttempts', parseInt(e.target.value) || 1)}
                  min="1"
                  max="10"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="passing-score">Passing score (%)</label>
                <input
                  id="passing-score"
                  type="number"
                  value={settings.passingScore}
                  onChange={(e) => updateSetting('passingScore', parseInt(e.target.value) || 70)}
                  min="0"
                  max="100"
                  className="form-input"
                />
              </div>
            </>
          )}
        </div>

        {/* Anti-Cheating Settings */}
        <div className="form-section">
          <div className="form-section__header">
            <ShieldIcon size={20} />
            <h3>Security & Anti-Cheating</h3>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.preventCheating.fullScreen}
                onChange={(e) => updatePreventCheating('fullScreen', e.target.checked)}
              />
              Require full-screen mode (exam simulation)
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.preventCheating.disableCopy}
                onChange={(e) => updatePreventCheating('disableCopy', e.target.checked)}
              />
              Disable copy/paste and right-click
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.preventCheating.randomizeOrder}
                onChange={(e) => updatePreventCheating('randomizeOrder', e.target.checked)}
              />
              Randomize question and answer order per student
            </label>
          </div>
        </div>

        {/* Quiz Mode Settings */}
        <div className="form-section">
          <div className="form-section__header">
            <h3>Quiz Mode</h3>
          </div>
          
          <div className="quiz-mode-settings">
            <div className={`quiz-mode-card ${settings.mode === 'practice' ? 'selected' : ''}`}>
              <input
                type="radio"
                id="mode-practice"
                name="quiz-mode"
                value="practice"
                checked={settings.mode === 'practice'}
                onChange={(e) => updateSetting('mode', e.target.value as QuizMode)}
              />
              <label htmlFor="mode-practice">
                <h4>Practice Mode</h4>
                <p>Relaxed learning with hints and immediate feedback</p>
                <ul>
                  <li>Hints available</li>
                  <li>Pause allowed</li>
                  <li>No time pressure</li>
                </ul>
              </label>
            </div>

            <div className={`quiz-mode-card ${settings.mode === 'exam-simulation' ? 'selected' : ''}`}>
              <input
                type="radio"
                id="mode-exam"
                name="quiz-mode"
                value="exam-simulation"
                checked={settings.mode === 'exam-simulation'}
                onChange={(e) => updateSetting('mode', e.target.value as QuizMode)}
              />
              <label htmlFor="mode-exam">
                <h4>Exam Simulation</h4>
                <p>Timed, focused testing experience</p>
                <ul>
                  <li>Strict timing</li>
                  <li>No hints</li>
                  <li>Full-screen mode</li>
                </ul>
              </label>
            </div>

            <div className={`quiz-mode-card ${settings.mode === 'boss-mode' ? 'selected' : ''}`}>
              <input
                type="radio"
                id="mode-boss"
                name="quiz-mode"
                value="boss-mode"
                checked={settings.mode === 'boss-mode'}
                onChange={(e) => updateSetting('mode', e.target.value as QuizMode)}
              />
              <label htmlFor="mode-boss">
                <h4>Boss Mode</h4>
                <p>Escalating difficulty with final boss question</p>
                <ul>
                  <li>Adaptive difficulty</li>
                  <li>XP rewards</li>
                  <li>Final boss challenge</li>
                </ul>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="quiz-settings__navigation">
        <div className="quiz-settings__progress">
          Step 3 of 4
        </div>
        
        <div className="quiz-settings__nav-buttons">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handlePrevious}
          >
            Previous
          </button>
          
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleNext}
          >
            Preview Quiz
          </button>
        </div>
      </div>
    </div>
  );
}





