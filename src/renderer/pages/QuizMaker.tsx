import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { useQuizCreation, useQuizLibrary } from '../state/quiz';
import { useAiUsageStore } from '../state/aiUsage';
import { useCourses } from '../state/dashboard';
import { PlusIcon, SparklesIcon, BookOpenIcon, ClockIcon, TargetIcon } from '../components/icons';
import AiTokenBadge from '../components/ui/AiTokenBadge';

// Import quiz creation components (will create these next)
import QuizSetupStep from '../components/quiz/QuizSetupStep';
import QuizQuestionsStep from '../components/quiz/QuizQuestionsStep';
import QuizSettingsStep from '../components/quiz/QuizSettingsStep';
import QuizPreviewStep from '../components/quiz/QuizPreviewStep';
import QuizLibrary from '../components/quiz/QuizLibrary';
import AiGenerationModal from '../components/quiz/AiGenerationModal';

export default function QuizMaker() {
  const [view, setView] = useState<'library' | 'create'>('library');
  const [showAiModal, setShowAiModal] = useState(false);
  
  const {
    step,
    creationMode,
    currentQuiz,
    currentQuestions,
    isGenerating,
    generationProgress,
    startQuizCreation,
    setCreationStep,
    resetCreation,
    saveQuiz
  } = useQuizCreation();
  
  const { quizzes, searchQuery, setSearchQuery } = useQuizLibrary();
  const { registerTask } = useAiUsageStore();
  const courses = useCourses();

  // Handle quiz creation completion
  const handleQuizSaved = async () => {
    const savedQuiz = await saveQuiz();
    if (savedQuiz) {
      resetCreation();
      setView('library');
    }
  };

  // Handle AI generation
  const handleAiGeneration = () => {
    setShowAiModal(true);
  };

  // Render creation steps
  const renderCreationStep = () => {
    switch (step) {
      case 'setup':
        return <QuizSetupStep />;
      case 'questions':
        return <QuizQuestionsStep />;
      case 'settings':
        return <QuizSettingsStep />;
      case 'preview':
        return <QuizPreviewStep onSave={handleQuizSaved} />;
      default:
        return <QuizSetupStep />;
    }
  };

  // Stats for the header
  const stats = {
    totalQuizzes: quizzes.length,
    totalQuestions: quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0),
    avgScore: quizzes.length > 0 
      ? quizzes.reduce((sum, quiz) => sum + quiz.analytics.averageScore, 0) / quizzes.length 
      : 0
  };

  return (
    <AppShell>
      <div className="quiz-maker">
        <div className="quiz-maker__header">
          <div className="quiz-maker__title">
            <h1>Quiz & Exam Maker</h1>
            <p>Create, customize, and master your knowledge with AI-powered quizzes</p>
          </div>
          
          {view === 'library' && (
            <div className="quiz-maker__stats">
              <div className="stat-card stat-card--compact">
                <BookOpenIcon size={18} />
                <span>{stats.totalQuizzes} Quizzes</span>
              </div>
              <div className="stat-card stat-card--compact">
                <TargetIcon size={18} />
                <span>{stats.totalQuestions} Questions</span>
              </div>
              <div className="stat-card stat-card--compact">
                <ClockIcon size={18} />
                <span>{Math.round(stats.avgScore)}% Avg Score</span>
              </div>
            </div>
          )}
        </div>

        {view === 'library' ? (
          <div className="quiz-maker__library">
            <div className="quiz-maker__toolbar">
              <div className="quiz-maker__search">
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="quiz-maker__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleAiGeneration}
                >
                  <SparklesIcon size={18} />
                  AI Generate
                  <AiTokenBadge category="generate" tokens={150} size="sm" />
                </button>
                
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    startQuizCreation('manual');
                    setView('create');
                  }}
                >
                  <PlusIcon size={18} />
                  Create Quiz
                </button>
              </div>
            </div>
            
            <QuizLibrary />
          </div>
        ) : (
          <div className="quiz-maker__creator">
            {/* Creation Progress Bar */}
            <div className="quiz-creation__progress">
              <div className="progress-steps">
                <div className={`progress-step ${step === 'setup' ? 'active' : step === 'questions' || step === 'settings' || step === 'preview' ? 'completed' : ''}`}>
                  <span className="progress-step__number">1</span>
                  <span className="progress-step__label">Setup</span>
                </div>
                <div className={`progress-step ${step === 'questions' ? 'active' : step === 'settings' || step === 'preview' ? 'completed' : ''}`}>
                  <span className="progress-step__number">2</span>
                  <span className="progress-step__label">Questions</span>
                </div>
                <div className={`progress-step ${step === 'settings' ? 'active' : step === 'preview' ? 'completed' : ''}`}>
                  <span className="progress-step__number">3</span>
                  <span className="progress-step__label">Settings</span>
                </div>
                <div className={`progress-step ${step === 'preview' ? 'active' : ''}`}>
                  <span className="progress-step__number">4</span>
                  <span className="progress-step__label">Preview</span>
                </div>
              </div>
              
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  resetCreation();
                  setView('library');
                }}
              >
                Cancel
              </button>
            </div>

            {/* AI Generation Progress */}
            {isGenerating && (
              <div className="ai-generation__progress">
                <div className="ai-generation__status">
                  <SparklesIcon size={20} className="spinning" />
                  <span>Generating quiz questions...</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar__fill" 
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <span className="ai-generation__percent">{Math.round(generationProgress)}%</span>
              </div>
            )}

            {/* Current Step Content */}
            <div className="quiz-creation__content">
              {renderCreationStep()}
            </div>
          </div>
        )}

        {/* AI Generation Modal */}
        {showAiModal && (
          <AiGenerationModal
            onClose={() => setShowAiModal(false)}
            onGenerate={(request) => {
              setShowAiModal(false);
              startQuizCreation('ai-generated');
              setView('create');
              // Handle AI generation logic here
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
