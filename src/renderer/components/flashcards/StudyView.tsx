import React, { useEffect, useState } from 'react';
import { useFlashcardStudy, useFlashcardLibrary } from '../../state/flashcards';
import { StudyMode } from '../../../shared/flashcards';
import {
  FlipIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  XIcon,
  LightbulbIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  TargetIcon,
  ClockIcon,
  StreakIcon
} from '../icons';

interface StudyViewProps {
  deckId: string;
  onBack: () => void;
}

export default function StudyView({ deckId, onBack }: StudyViewProps) {
  const { selectedDeck } = useFlashcardLibrary();
  const {
    currentSession,
    currentCardIndex,
    isCardFlipped,
    showHint,
    isPaused,
    sessionResponses,
    studySettings,
    startStudySession,
    flipCard,
    toggleHint,
    answerCard,
    nextCard,
    previousCard,
    pauseSession,
    resumeSession,
    endSession
  } = useFlashcardStudy();

  const [studyMode, setStudyMode] = useState<StudyMode>('classic-flip');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (selectedDeck && !sessionStarted) {
      startStudySession(deckId, studyMode);
      setSessionStarted(true);
      setStartTime(Date.now());
    }
  }, [selectedDeck, deckId, studyMode, sessionStarted, startStudySession]);

  if (!selectedDeck || !currentSession) {
    return (
      <div className="study-view">
        <div className="study-view__loading">
          <h2>Loading deck...</h2>
        </div>
      </div>
    );
  }

  const currentCard = currentSession.cards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / currentSession.cards.length) * 100;
  const isLastCard = currentCardIndex >= currentSession.cards.length - 1;

  const handleAnswer = (confidence: 1 | 2 | 3 | 4 | 5) => {
    if (!currentCard) return;
    
    const responseTime = Date.now() - startTime;
    answerCard('', confidence, responseTime);
    
    if (isLastCard) {
      // End session
      endSession().then(() => {
        setShowResults(true);
      });
    } else {
      nextCard();
      setStartTime(Date.now());
    }
  };

  const handleNext = () => {
    if (isLastCard) {
      endSession().then(() => {
        setShowResults(true);
      });
    } else {
      nextCard();
      setStartTime(Date.now());
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      previousCard();
      setStartTime(Date.now());
    }
  };

  if (showResults) {
    const correctAnswers = sessionResponses.filter(r => r.isCorrect).length;
    const accuracy = sessionResponses.length > 0 ? (correctAnswers / sessionResponses.length) * 100 : 0;
    const totalTime = sessionResponses.reduce((sum, r) => sum + r.responseTime, 0) / 1000; // Convert to seconds

    return (
      <div className="study-view">
        <div className="study-results">
          <div className="study-results__header">
            <h2>Study Session Complete!</h2>
            <p>Great job studying {selectedDeck.title}</p>
          </div>

          <div className="study-results__stats">
            <div className="result-stat">
              <div className="result-stat__value">{sessionResponses.length}</div>
              <div className="result-stat__label">Cards Studied</div>
            </div>
            <div className="result-stat">
              <div className="result-stat__value">{Math.round(accuracy)}%</div>
              <div className="result-stat__label">Accuracy</div>
            </div>
            <div className="result-stat">
              <div className="result-stat__value">{Math.round(totalTime)}s</div>
              <div className="result-stat__label">Total Time</div>
            </div>
            <div className="result-stat">
              <div className="result-stat__value">{correctAnswers}</div>
              <div className="result-stat__label">Correct</div>
            </div>
          </div>

          <div className="study-results__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onBack}
            >
              Back to Library
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setShowResults(false);
                setSessionStarted(false);
                startStudySession(deckId, studyMode);
              }}
            >
              Study Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="study-view">
      <div className="study-view__header">
        <div className="study-view__nav">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onBack}
          >
            <ArrowLeftIcon size={18} />
            Back
          </button>
        </div>

        <div className="study-view__info">
          <h1 className="study-view__title">{selectedDeck.title}</h1>
          <div className="study-view__meta">
            <span className="study-meta">
              <TargetIcon size={14} />
              {currentCardIndex + 1} of {currentSession.cards.length}
            </span>
            <span className="study-meta">
              <ClockIcon size={14} />
              {studyMode.replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="study-view__controls">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={isPaused ? resumeSession : pauseSession}
          >
            {isPaused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div className="study-view__progress">
        <div className="progress-bar">
          <div 
            className="progress-bar__fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{Math.round(progress)}% Complete</span>
      </div>

      <div className="study-view__content">
        {currentCard && (
          <div className="flashcard-study">
            <div className={`flashcard ${isCardFlipped ? 'flipped' : ''}`}>
              <div className="flashcard__front">
                <div className="flashcard__content">
                  <h3>Question</h3>
                  <p>{currentCard.front}</p>
                  
                  {currentCard.hint && showHint && (
                    <div className="flashcard__hint">
                      <LightbulbIcon size={16} />
                      <span>{currentCard.hint}</span>
                    </div>
                  )}
                </div>
                
                <div className="flashcard__actions">
                  {currentCard.hint && !showHint && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={toggleHint}
                    >
                      <LightbulbIcon size={16} />
                      Show Hint
                    </button>
                  )}
                  
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={flipCard}
                  >
                    <FlipIcon size={18} />
                    Show Answer
                  </button>
                </div>
              </div>

              <div className="flashcard__back">
                <div className="flashcard__content">
                  <h3>Answer</h3>
                  <p>{currentCard.back}</p>
                  
                  {currentCard.explanation && (
                    <div className="flashcard__explanation">
                      <strong>Explanation:</strong>
                      <p>{currentCard.explanation}</p>
                    </div>
                  )}
                </div>

                <div className="flashcard__rating">
                  <h4>How well did you know this?</h4>
                  <div className="confidence-buttons">
                    <button
                      type="button"
                      className="confidence-btn confidence-btn--again"
                      onClick={() => handleAnswer(1)}
                    >
                      <XIcon size={16} />
                      Again
                    </button>
                    <button
                      type="button"
                      className="confidence-btn confidence-btn--hard"
                      onClick={() => handleAnswer(2)}
                    >
                      Hard
                    </button>
                    <button
                      type="button"
                      className="confidence-btn confidence-btn--good"
                      onClick={() => handleAnswer(3)}
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      className="confidence-btn confidence-btn--easy"
                      onClick={() => handleAnswer(4)}
                    >
                      Easy
                    </button>
                    <button
                      type="button"
                      className="confidence-btn confidence-btn--perfect"
                      onClick={() => handleAnswer(5)}
                    >
                      <CheckIcon size={16} />
                      Perfect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="study-view__navigation">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handlePrevious}
          disabled={currentCardIndex === 0}
        >
          <ArrowLeftIcon size={18} />
          Previous
        </button>

        <div className="study-view__card-counter">
          {currentCardIndex + 1} / {currentSession.cards.length}
        </div>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleNext}
        >
          Next
          <ArrowRightIcon size={18} />
        </button>
      </div>
    </div>
  );
}





