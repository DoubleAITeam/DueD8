import React, { useState, useEffect, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import { useFlashcardLibrary, useFlashcardCreation, useFlashcardProgress } from '../state/flashcards';
import { useCourses } from '../state/dashboard';
import { useAiUsageStore } from '../state/aiUsage';
import {
  PlusIcon,
  SparklesIcon,
  SearchIcon,
  FilterIcon,
  SortIcon,
  FlashcardIcon,
  StudyIcon,
  StackIcon,
  TargetIcon,
  TrendingUpIcon,
  StreakIcon,
  AlertCircleIcon,
  ClockIcon,
  CheckIcon,
  XIcon
} from '../components/icons';
import AiTokenBadge from '../components/ui/AiTokenBadge';
import StatCard from '../components/ui/StatCard';

export default function Flashcards() {
  const [view, setView] = useState<'home' | 'create' | 'study'>('home');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersMounted, setFiltersMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const firstFilterFieldRef = useRef<HTMLSelectElement>(null);
  
  const {
    filteredDecks,
    searchQuery,
    filter,
    viewMode,
    selectedDeck,
    loadDecks,
    refreshPersonalizedDecks,
    setSearchQuery,
    setFilter,
    clearFilters,
    setViewMode,
    selectDeck
  } = useFlashcardLibrary();
  
  const {
    startDeckCreation
  } = useFlashcardCreation();
  
  const {
    totalDecks,
    totalCards,
    cardsStudiedToday,
    cardsDueToday,
    streak,
    updateProgress,
    getRecommendedDecks
  } = useFlashcardProgress();
  
  const { registerTask } = useAiUsageStore();
  const courses = useCourses();
  
  useEffect(() => {
    loadDecks();
    updateProgress();
  }, [loadDecks, updateProgress]);
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setIsMobileViewport(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  const recommendedDecks = getRecommendedDecks();
  
  const handleCreateDeck = (mode: 'manual' | 'ai-generated') => {
    startDeckCreation(mode);
    setView('create');
  };
  
  const handleAiGeneration = () => {
    setShowAiModal(true);
  };
  
  const handleStudyDeck = (deckId: string) => {
    selectDeck(deckId);
    setView('study');
  };
  
  const handleToggleFilters = () => {
    if (showFilters) {
      setShowFilters(false);
      return;
    }

    setFiltersMounted(true);

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setShowFilters(true));
    } else {
      setShowFilters(true);
    }
  };

  const handleCloseFilters = () => {
    setShowFilters(false);
  };

  const handleFiltersBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobileViewport) {
      return;
    }

    if (event.target === event.currentTarget) {
      setShowFilters(false);
    }
  };

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowFilters(false);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown);
    }

    let focusTimer: number | undefined;
    if (typeof window !== 'undefined') {
      focusTimer = window.setTimeout(() => {
        firstFilterFieldRef.current?.focus();
      }, 80);
    } else {
      firstFilterFieldRef.current?.focus();
    }

    let previousOverflow: string | null = null;
    if (isMobileViewport && typeof document !== 'undefined') {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousOverflow !== null) {
          document.body.style.overflow = previousOverflow;
        }
      }

      if (typeof window !== 'undefined' && typeof focusTimer === 'number') {
        window.clearTimeout(focusTimer);
      }
    };
  }, [showFilters, isMobileViewport]);

  useEffect(() => {
    if (showFilters || !filtersMounted) {
      return;
    }

    let unmountTimer: number | undefined;

    if (typeof window !== 'undefined') {
      unmountTimer = window.setTimeout(() => {
        setFiltersMounted(false);
      }, 240);
    } else {
      setFiltersMounted(false);
    }

    filtersButtonRef.current?.focus();

    return () => {
      if (typeof window !== 'undefined' && typeof unmountTimer === 'number') {
        window.clearTimeout(unmountTimer);
      }
    };
  }, [showFilters, filtersMounted]);
  
  const stats = [
    {
      title: 'Total Decks',
      value: totalDecks.toString(),
      icon: StackIcon,
      color: '#6366f1'
    },
    {
      title: 'Total Cards',
      value: totalCards.toString(),
      icon: FlashcardIcon,
      color: '#8b5cf6'
    },
    {
      title: 'Cards Due',
      value: cardsDueToday.toString(),
      icon: TargetIcon,
      color: '#f59e0b'
    },
    {
      title: 'Study Streak',
      value: `${streak.currentStreak} days`,
      icon: StreakIcon,
      color: '#ef4444'
    }
  ];
  
  const renderEmptyState = () => (
    <div className="flashcards__empty">
      <div className="empty-state">
        <SparklesIcon size={64} className="empty-state__icon" />
        <h3 className="empty-state__title">Smart Flashcards Powered by Your Course Data</h3>
        <p className="empty-state__description">
          I'll analyze your Canvas courses, grades, and assignment deadlines to create personalized flashcard decks. 
          Cards are automatically prioritized based on your performance and upcoming exams.
        </p>
        
        <div className="empty-state__features">
          <div className="feature-item">
            <CheckIcon size={20} className="feature-icon text-green-500" />
            <span>Course-specific content based on your enrolled classes</span>
          </div>
          <div className="feature-item">
            <TrendingUpIcon size={20} className="feature-icon text-blue-500" />
            <span>Difficulty adjusted to your current grades</span>
          </div>
          <div className="feature-item">
            <ClockIcon size={20} className="feature-icon text-orange-500" />
            <span>Prioritized by upcoming assignment deadlines</span>
          </div>
          <div className="feature-item">
            <TargetIcon size={20} className="feature-icon text-purple-500" />
            <span>Spaced repetition optimized for your learning pace</span>
          </div>
        </div>
        
        <div className="empty-state__actions">
          <button
            type="button"
            className="btn btn--primary btn--large"
            onClick={refreshPersonalizedDecks}
          >
            <SparklesIcon size={18} />
            Generate Smart Decks from My Courses
            <AiTokenBadge category="generate" tokens={150} size="sm" />
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => handleCreateDeck('manual')}
          >
            <PlusIcon size={18} />
            Create Custom Deck
          </button>
        </div>
      </div>
    </div>
  );
  
  const getUrgencyIcon = (deck: any) => {
    if (deck.tags?.includes('struggling-overall-performance')) {
      return <AlertCircleIcon size={16} className="text-red-500" />;
    }
    if (deck.tags?.includes('exam-prep')) {
      return <ClockIcon size={16} className="text-orange-500" />;
    }
    if (deck.tags?.includes('needs-attention')) {
      return <AlertCircleIcon size={16} className="text-yellow-500" />;
    }
    if (deck.tags?.includes('high-performer')) {
      return <CheckIcon size={16} className="text-green-500" />;
    }
    return null;
  };

  const getPerformanceIndicator = (deck: any) => {
    if (deck.tags?.includes('struggling-overall-performance')) {
      return { label: 'Critical', color: 'bg-red-100 text-red-800', priority: 'critical' };
    }
    if (deck.tags?.includes('needs-attention')) {
      return { label: 'Needs Focus', color: 'bg-yellow-100 text-yellow-800', priority: 'high' };
    }
    if (deck.tags?.includes('exam-prep')) {
      return { label: 'Exam Prep', color: 'bg-orange-100 text-orange-800', priority: 'high' };
    }
    if (deck.tags?.includes('high-performer')) {
      return { label: 'Mastery', color: 'bg-green-100 text-green-800', priority: 'low' };
    }
    return null;
  };

  const renderDeckCard = (deck: any) => (
    <div key={deck.id} className="deck-card">
      <div className="deck-card__header">
        <div className="deck-card__icon" style={{ backgroundColor: deck.color }}>
          <FlashcardIcon size={20} />
          {getUrgencyIcon(deck)}
        </div>
        <div className="deck-card__indicators">
          {getPerformanceIndicator(deck) && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              getPerformanceIndicator(deck)?.color
            }`}>
              {getPerformanceIndicator(deck)?.label}
            </span>
          )}
        </div>
        <div className="deck-card__menu">
          <button type="button" className="btn btn--ghost btn--sm">⋯</button>
        </div>
      </div>
      
      <div className="deck-card__content">
        <h3 className="deck-card__title">{deck.title}</h3>
        {deck.description && (
          <p className="deck-card__description">{deck.description}</p>
        )}
        
        <div className="deck-card__stats">
          <span className="deck-card__stat">
            {deck.cardCount} cards
          </span>
          <span className="deck-card__stat">
            {Math.round((deck.analytics?.overallAccuracy || 0) * 100)}% accuracy
          </span>
          {deck.dueCards > 0 && (
            <span className="deck-card__stat deck-card__stat--due">
              {deck.dueCards} due
            </span>
          )}
          {deck.newCards > 0 && (
            <span className="deck-card__stat deck-card__stat--new">
              {deck.newCards} new
            </span>
          )}
        </div>
        
        {deck.tags && deck.tags.length > 0 && (
          <div className="deck-card__tags">
            {deck.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="tag tag--sm">{tag}</span>
            ))}
            {deck.tags.length > 3 && (
              <span className="tag tag--sm">+{deck.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
      
      <div className="deck-card__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => handleStudyDeck(deck.id)}
          disabled={deck.cardCount === 0}
        >
          <StudyIcon size={16} />
          Study
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => selectDeck(deck.id)}
        >
          Edit
        </button>
      </div>
    </div>
  );
  
  const renderDecksGrid = () => (
    <div className="flashcards__grid">
      {filteredDecks.map(renderDeckCard)}
    </div>
  );
  
  const renderStudyHeatmap = () => {
    const today = new Date();
    const days = [];
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Simulate study activity (in real app, this would come from analytics)
      const dayOfWeek = date.getDay();
      const activity = Math.random() * (dayOfWeek === 0 || dayOfWeek === 6 ? 0.5 : 1); // Less activity on weekends
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        activity: activity,
        cardsStudied: Math.floor(activity * 50)
      });
    }
    
    return (
      <div className="study-heatmap">
        <h3 className="heatmap-title">📊 Study Activity</h3>
        <div className="heatmap-grid">
          {days.map((day) => (
            <div key={day.date} className="heatmap-day">
              <div 
                className={`heatmap-cell ${
                  day.activity > 0.7 ? 'heatmap-cell--high' :
                  day.activity > 0.4 ? 'heatmap-cell--medium' :
                  day.activity > 0.1 ? 'heatmap-cell--low' : 'heatmap-cell--none'
                }`}
                title={`${day.dayName}: ${day.cardsStudied} cards studied`}
              />
              <span className="heatmap-label">{day.dayName}</span>
            </div>
          ))}
        </div>
        <div className="heatmap-legend">
          <span className="legend-text">Less</span>
          <div className="legend-scale">
            <div className="heatmap-cell heatmap-cell--none" />
            <div className="heatmap-cell heatmap-cell--low" />
            <div className="heatmap-cell heatmap-cell--medium" />
            <div className="heatmap-cell heatmap-cell--high" />
          </div>
          <span className="legend-text">More</span>
        </div>
      </div>
    );
  };

  const renderContextualReminders = () => {
    const reminders = [];
    
    // Check for upcoming exams (simulate)
    const upcomingExamDecks = filteredDecks.filter(deck => 
      deck.tags?.includes('exam-prep') && deck.cardsDue > 0
    );
    
    if (upcomingExamDecks.length > 0) {
      reminders.push({
        type: 'exam',
        icon: <ClockIcon size={16} className="text-orange-500" />,
        message: `${upcomingExamDecks.length} deck${upcomingExamDecks.length > 1 ? 's' : ''} need review for upcoming exams`,
        action: 'Study Now',
        priority: 'high'
      });
    }
    
    // Check for struggling courses
    const strugglingDecks = filteredDecks.filter(deck => 
      deck.tags?.includes('needs-attention')
    );
    
    if (strugglingDecks.length > 0) {
      reminders.push({
        type: 'struggling',
        icon: <AlertCircleIcon size={16} className="text-red-500" />,
        message: `Focus needed: ${strugglingDecks.length} course${strugglingDecks.length > 1 ? 's' : ''} below target performance`,
        action: 'Review Cards',
        priority: 'high'
      });
    }
    
    // Check for streak maintenance
    if (streak.currentStreak >= 3 && cardsDueToday > 0) {
      reminders.push({
        type: 'streak',
        icon: <StreakIcon size={16} className="text-green-500" />,
        message: `Keep your ${streak.currentStreak}-day streak alive! ${cardsDueToday} cards due today`,
        action: 'Continue Streak',
        priority: 'medium'
      });
    }
    
    if (reminders.length === 0) return null;
    
    return (
      <div className="contextual-reminders">
        <h3 className="reminders-title">🔔 Smart Reminders</h3>
        <div className="reminders-list">
          {reminders.map((reminder, index) => (
            <div 
              key={index} 
              className={`reminder-card reminder-card--${reminder.priority}`}
            >
              <div className="reminder-icon">{reminder.icon}</div>
              <div className="reminder-content">
                <p className="reminder-message">{reminder.message}</p>
                <button 
                  className="reminder-action btn btn--sm btn--primary"
                  onClick={() => {
                    // In real app, this would navigate to appropriate study mode
                    console.log('Reminder action:', reminder.type);
                  }}
                >
                  {reminder.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filtersPanelClassName = [
    'flashcards__filters',
    showFilters ? 'flashcards__filters--open' : 'flashcards__filters--closing',
    isMobileViewport ? 'flashcards__filters--mobile' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const renderHomeView = () => (
    <div className="flashcards__home">
      {/* Header Stats */}
      <div className="flashcards__stats">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>
      
      {/* Personalization Layer */}
      <div className="flashcards__personalization">
        <div className="personalization-grid">
          <div className="personalization-item">
            {renderStudyHeatmap()}
          </div>
          <div className="personalization-item">
            {renderContextualReminders()}
          </div>
        </div>
      </div>
      
      {/* Recommended Decks */}
      {recommendedDecks.length > 0 && (
        <div className="flashcards__section">
          <div className="section-header">
            <div>
              <h2 className="section-title">🎯 Smart Recommendations</h2>
              <p className="section-description">
                AI-curated decks prioritized by your course performance, grades, and upcoming deadlines
              </p>
            </div>
            {recommendedDecks.some((deck: any) => deck.urgencyLevel === 'critical') && (
              <div className="urgency-alert">
                <AlertCircleIcon size={18} className="text-red-500" />
                <span className="text-red-700 font-medium">Urgent attention needed</span>
              </div>
            )}
          </div>
          
          {/* Critical Decks First */}
          {recommendedDecks.filter((deck: any) => deck.urgencyLevel === 'critical').length > 0 && (
            <div className="flashcards__critical">
              <h3 className="subsection-title text-red-700">
                <AlertCircleIcon size={16} className="inline mr-2" />
                Critical - Needs Immediate Attention
              </h3>
              <div className="flashcards__recommended flashcards__recommended--critical">
                {recommendedDecks
                  .filter((deck: any) => deck.urgencyLevel === 'critical')
                  .slice(0, 2)
                  .map(renderDeckCard)}
              </div>
            </div>
          )}
          
          {/* High Priority Decks */}
          {recommendedDecks.filter((deck: any) => deck.urgencyLevel === 'high').length > 0 && (
            <div className="flashcards__high-priority">
              <h3 className="subsection-title text-orange-700">
                <ClockIcon size={16} className="inline mr-2" />
                High Priority - Exam Prep & Focus Areas
              </h3>
              <div className="flashcards__recommended">
                {recommendedDecks
                  .filter((deck: any) => deck.urgencyLevel === 'high')
                  .slice(0, 3)
                  .map(renderDeckCard)}
              </div>
            </div>
          )}
          
          {/* Regular Priority Decks */}
          {recommendedDecks.filter((deck: any) => ['medium', 'low'].includes(deck.urgencyLevel)).length > 0 && (
            <div className="flashcards__regular">
              <h3 className="subsection-title text-blue-700">
                <StudyIcon size={16} className="inline mr-2" />
                Regular Study - Maintain & Review
              </h3>
              <div className="flashcards__recommended">
                {recommendedDecks
                  .filter((deck: any) => ['medium', 'low'].includes(deck.urgencyLevel))
                  .slice(0, 3)
                  .map(renderDeckCard)}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Toolbar */}
      <div className="flashcards__toolbar">
        <div className="flashcards__toolbar-left">
          <h2 className="section-title">All Decks</h2>
          <div className="flashcards__search">
            <SearchIcon size={18} className="search-input__icon" />
            <input
              type="text"
              placeholder="Search decks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <div
          className="flashcards__toolbar-right"
          role="toolbar"
          aria-label="Flashcard actions"
        >
          <div className="flashcards__actions-grid">
            <div
              className="flashcards__view-toggle"
              role="group"
              aria-label="Change deck layout"
            >
              <button
                type="button"
                className={`btn btn--ghost ${viewMode === 'grid' ? 'btn--active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${viewMode === 'list' ? 'btn--active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>

            <button
              type="button"
              className="btn btn--ghost flashcards__action"
              onClick={handleToggleFilters}
              ref={filtersButtonRef}
              aria-expanded={showFilters}
              aria-controls="flashcard-filters-panel"
            >
              <FilterIcon size={18} />
              Filters
            </button>

            <button
              type="button"
              className="btn btn--ghost flashcards__action"
              onClick={refreshPersonalizedDecks}
              title="Refresh decks based on current course performance and deadlines"
            >
              <TrendingUpIcon size={18} />
              Update Course Decks
            </button>

            <button
              type="button"
              className="btn btn--secondary flashcards__action flashcards__action--badge"
              onClick={handleAiGeneration}
              title="Generate cards from syllabus, notes, or course materials"
            >
              <SparklesIcon size={18} />
              AI Generate from Content
              <AiTokenBadge category="generate" tokens={200} size="sm" />
            </button>

            <button
              type="button"
              className="btn btn--ghost flashcards__action"
              onClick={() => {
                const dueDecks = filteredDecks.filter(deck =>
                  deck.cards?.some(card => card.nextReviewDate <= new Date().toISOString())
                );
                if (dueDecks.length > 0) {
                  handleStudyDeck(dueDecks[0].id);
                }
              }}
              disabled={!filteredDecks.some(deck =>
                deck.cards?.some(card => card.nextReviewDate <= new Date().toISOString())
              )}
              title="Quick 5-minute study session with due cards"
            >
              <TargetIcon size={16} />
              Quick Study (5 min)
            </button>

            <button
              type="button"
              className="btn btn--primary flashcards__action"
              onClick={() => handleCreateDeck('manual')}
            >
              <PlusIcon size={18} />
              Create Deck
            </button>
          </div>
        </div>
      </div>
      
      {/* Enhanced Filters Panel */}
      {(filtersMounted || showFilters) && (
        <div
          className={filtersPanelClassName}
          role={isMobileViewport ? 'dialog' : 'region'}
          aria-modal={isMobileViewport}
          aria-labelledby="flashcard-filters-title"
          onClick={handleFiltersBackdropClick}
        >
          <div
            className="filters-panel"
            id="flashcard-filters-panel"
            tabIndex={-1}
          >
            <div className="filters-panel__header">
              <div>
                <h3 id="flashcard-filters-title" className="filters-panel__title">
                  Filter decks
                </h3>
                <p className="filters-panel__subtitle">
                  Focus your study by course, performance, and urgency
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost filters-panel__close"
                onClick={handleCloseFilters}
                aria-label="Close filters panel"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="filters-grid">
              <div className="filters-panel__section">
                <label className="filters-panel__label" htmlFor="filters-course">
                  Course
                </label>
                <select
                  id="filters-course"
                  ref={firstFilterFieldRef}
                  value={filter.courseId || ''}
                  onChange={(e) => setFilter({ courseId: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">All Courses</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filters-panel__section">
                <label className="filters-panel__label" htmlFor="filters-performance">
                  Performance
                </label>
                <select
                  id="filters-performance"
                  value={filter.tags?.includes('needs-attention') ? 'struggling' :
                         filter.tags?.includes('high-performer') ? 'excelling' : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'struggling') {
                      setFilter({ tags: ['needs-attention'] });
                    } else if (value === 'excelling') {
                      setFilter({ tags: ['high-performer'] });
                    } else {
                      setFilter({ tags: undefined });
                    }
                  }}
                >
                  <option value="">All Performance Levels</option>
                  <option value="struggling">Needs Attention</option>
                  <option value="excelling">High Performance</option>
                </select>
              </div>

              <div className="filters-panel__section">
                <label className="filters-panel__label" htmlFor="filters-status">
                  Study Status
                </label>
                <select
                  id="filters-status"
                  value={filter.dueStatus || ''}
                  onChange={(e) => setFilter({ dueStatus: e.target.value as any })}
                >
                  <option value="">All Cards</option>
                  <option value="due">Due for Review</option>
                  <option value="new">New Cards</option>
                  <option value="learned">Already Learned</option>
                </select>
              </div>

              <div className="filters-panel__section">
                <span className="filters-panel__label">Urgency</span>
                <div className="filter-buttons">
                  <button
                    type="button"
                    className={`filter-chip ${
                      filter.tags?.includes('exam-prep') ? 'filter-chip--active' : ''
                    }`}
                    onClick={() => {
                      const isActive = filter.tags?.includes('exam-prep');
                      setFilter({
                        tags: isActive ? undefined : ['exam-prep']
                      });
                    }}
                  >
                    <ClockIcon size={14} />
                    Exam Prep
                  </button>
                </div>
              </div>
            </div>

            <div className="filters-panel__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clearFilters}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Decks Display */}
      {filteredDecks.length === 0 ? (
        renderEmptyState()
      ) : (
        renderDecksGrid()
      )}
    </div>
  );
  
  return (
    <AppShell>
      <div className="flashcards">
        <div className="flashcards__header">
          <div className="flashcards__title">
            <FlashcardIcon size={24} />
            <h1>Flashcards</h1>
            <span className="flashcards__subtitle">
              Personalized for your courses
            </span>
          </div>
          
          {(cardsStudiedToday > 0 || cardsDueToday > 0) && (
            <div className="flashcards__progress">
              {cardsStudiedToday > 0 && (
                <span className="progress-text">
                  {cardsStudiedToday} cards studied today
                </span>
              )}
              {cardsDueToday > 0 && (
                <span className="due-text">
                  {cardsDueToday} cards due for review
                </span>
              )}
              {streak.currentStreak > 0 && (
                <span className="streak-badge">
                  <StreakIcon size={16} />
                  {streak.currentStreak} day streak
                </span>
              )}
            </div>
          )}
        </div>
        
        {view === 'home' && renderHomeView()}
        {view === 'create' && (
          <div className="flashcards__create">
            <p>Create view will be implemented in the next step</p>
          </div>
        )}
        {view === 'study' && selectedDeck && (
          <div className="flashcards__study">
            <p>Study view for deck: {selectedDeck.title}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
