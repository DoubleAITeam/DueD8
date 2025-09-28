import React, { useState } from 'react';
import { useQuizCreation } from '../../state/quiz';
import { useCourses } from '../../state/dashboard';
import { QuizMode, DifficultyLevel } from '../../../shared/quiz';
import { BookOpenIcon, ClockIcon, TargetIcon, SparklesIcon } from '../icons';

const QUIZ_MODES = [
  {
    id: 'practice' as QuizMode,
    title: 'Practice Mode',
    description: 'Relaxed learning with hints and immediate feedback',
    icon: BookOpenIcon,
    color: 'blue'
  },
  {
    id: 'exam-simulation' as QuizMode,
    title: 'Exam Simulation',
    description: 'Timed, focused testing experience',
    icon: ClockIcon,
    color: 'orange'
  },
  {
    id: 'boss-mode' as QuizMode,
    title: 'Boss Mode',
    description: 'Escalating difficulty with final boss question',
    icon: TargetIcon,
    color: 'red'
  }
];

const DIFFICULTY_LEVELS = [
  { id: 'easy' as DifficultyLevel, label: 'Easy', color: 'green' },
  { id: 'medium' as DifficultyLevel, label: 'Medium', color: 'yellow' },
  { id: 'hard' as DifficultyLevel, label: 'Hard', color: 'orange' },
  { id: 'expert' as DifficultyLevel, label: 'Expert', color: 'red' }
];

export default function QuizSetupStep() {
  const { currentQuiz, creationMode, updateQuizMetadata, setCreationStep } = useQuizCreation();
  const courses = useCourses();
  
  const [title, setTitle] = useState(currentQuiz?.title || '');
  const [description, setDescription] = useState(currentQuiz?.description || '');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(currentQuiz?.courseId || null);
  const [selectedMode, setSelectedMode] = useState<QuizMode>(currentQuiz?.settings?.mode || 'practice');
  const [estimatedTime, setEstimatedTime] = useState(currentQuiz?.settings?.timeLimit || 30);

  const handleNext = () => {
    updateQuizMetadata({
      title,
      description,
      courseId: selectedCourse || undefined,
      createdBy: creationMode === 'ai-generated' ? 'ai' : 'user',
      settings: {
        ...currentQuiz?.settings,
        mode: selectedMode,
        timeLimit: estimatedTime,
        showFeedback: 'after-submission',
        allowRetake: true
      }
    });
    setCreationStep('questions');
  };

  const isValid = title.trim().length > 0;

  return (
    <div className="quiz-setup">
      <div className="quiz-setup__header">
        <h2>Quiz Setup</h2>
        <p>Configure the basic settings for your quiz</p>
      </div>

      <div className="quiz-setup__form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label htmlFor="quiz-title">Quiz Title *</label>
            <input
              id="quiz-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title for your quiz"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quiz-description">Description</label>
            <textarea
              id="quiz-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: Describe what this quiz covers"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="quiz-course">Associated Course</label>
            <select
              id="quiz-course"
              value={selectedCourse || ''}
              onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
              className="form-select"
            >
              <option value="">No specific course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quiz Mode Selection */}
        <div className="form-section">
          <h3>Quiz Mode</h3>
          <p className="form-section__description">
            Choose how students will experience this quiz
          </p>
          
          <div className="quiz-modes">
            {QUIZ_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`quiz-mode ${selectedMode === mode.id ? 'quiz-mode--selected' : ''} quiz-mode--${mode.color}`}
                onClick={() => setSelectedMode(mode.id)}
              >
                <div className="quiz-mode__icon">
                  <mode.icon size={24} />
                </div>
                <div className="quiz-mode__content">
                  <h4>{mode.title}</h4>
                  <p>{mode.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Settings */}
        <div className="form-section">
          <h3>Time Settings</h3>
          
          <div className="form-group">
            <label htmlFor="time-limit">Time Limit (minutes)</label>
            <div className="form-input-group">
              <input
                id="time-limit"
                type="number"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 30)}
                min="5"
                max="180"
                className="form-input"
              />
              <span className="form-input-addon">minutes</span>
            </div>
            <p className="form-help">
              Recommended: 1-2 minutes per question. Set to 0 for no time limit.
            </p>
          </div>
        </div>

        {/* AI Generation Notice */}
        {creationMode === 'ai-generated' && (
          <div className="ai-notice">
            <div className="ai-notice__icon">
              <SparklesIcon size={20} />
            </div>
            <div className="ai-notice__content">
              <h4>AI-Generated Quiz</h4>
              <p>
                Questions will be automatically generated based on your course materials and preferences. 
                You can review and edit them in the next step.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="quiz-setup__navigation">
        <div className="quiz-setup__progress">
          Step 1 of 4
        </div>
        
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleNext}
          disabled={!isValid}
        >
          Continue to Questions
        </button>
      </div>
    </div>
  );
}





