import React, { useState } from 'react';
import { useQuizLibrary } from '../../state/quiz';
import { useCourses } from '../../state/dashboard';
import { QuizPreview } from '../../../shared/quiz';
import { PlayIcon, EditIcon, CopyIcon, TrashIcon, FilterIcon, SortIcon } from '../icons';

export default function QuizLibrary() {
  const { 
    quizzes, 
    searchQuery, 
    selectedQuiz,
    setFilterCourse,
    setFilterDifficulty,
    setSortBy,
    selectQuiz,
    deleteQuiz,
    duplicateQuiz
  } = useQuizLibrary();
  
  const courses = useCourses();
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortByLocal] = useState('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortByLocal(field);
    setSortOrder(newOrder);
    setSortBy(field as any, newOrder);
  };

  const handleTakeQuiz = (quiz: QuizPreview) => {
    // This would navigate to the quiz taking interface
    console.log('Take quiz:', quiz.id);
  };

  const handleEditQuiz = (quiz: QuizPreview) => {
    // This would open the quiz in edit mode
    console.log('Edit quiz:', quiz.id);
  };

  const handleDuplicateQuiz = async (quiz: QuizPreview) => {
    try {
      await duplicateQuiz(quiz.id);
    } catch (error) {
      console.error('Failed to duplicate quiz:', error);
    }
  };

  const handleDeleteQuiz = async (quiz: QuizPreview) => {
    if (window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      try {
        await deleteQuiz(quiz.id);
      } catch (error) {
        console.error('Failed to delete quiz:', error);
      }
    }
  };

  // Transform quizzes to preview format
  const quizPreviews: QuizPreview[] = quizzes.map(quiz => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    courseId: quiz.courseId,
    createdBy: quiz.createdBy,
    createdAt: quiz.createdAt,
    questionCount: quiz.questions.length,
    estimatedTime: quiz.settings.timeLimit || Math.ceil(quiz.questions.length * 2),
    difficulty: quiz.questions.length > 0 ? 
      (quiz.questions.every(q => q.difficulty === quiz.questions[0].difficulty) ? 
        quiz.questions[0].difficulty : 'mixed') : 'medium',
    lastAttempt: undefined // Would come from attempts data
  }));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="quiz-library">
      {/* Filters and Sorting */}
      <div className="quiz-library__toolbar">
        <div className="quiz-library__filters">
          <button
            type="button"
            className={`btn btn--ghost btn--sm ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterIcon size={16} />
            Filters
          </button>

          <div className="quiz-library__sort">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => handleSort('created')}
            >
              <SortIcon size={16} />
              Sort by Date {sortBy === 'created' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => handleSort('title')}
            >
              Title {sortBy === 'title' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => handleSort('attempts')}
            >
              Popularity {sortBy === 'attempts' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="quiz-library__filter-panel">
            <div className="filter-group">
              <label>Course</label>
              <select
                onChange={(e) => setFilterCourse(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select form-select--sm"
              >
                <option value="">All courses</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Difficulty</label>
              <select
                onChange={(e) => setFilterDifficulty(e.target.value as any)}
                className="form-select form-select--sm"
              >
                <option value="all">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quiz Grid */}
      <div className="quiz-library__grid">
        {quizPreviews.length === 0 ? (
          <div className="quiz-library__empty">
            <div className="empty-state">
              <h3>No quizzes yet</h3>
              <p>Create your first quiz to get started with interactive learning.</p>
            </div>
          </div>
        ) : (
          quizPreviews.map(quiz => (
            <div 
              key={quiz.id} 
              className={`quiz-card ${selectedQuiz?.id === quiz.id ? 'selected' : ''}`}
              onClick={() => selectQuiz(quiz.id)}
            >
              <div className="quiz-card__header">
                <div className="quiz-card__meta">
                  <div className={`difficulty-badge difficulty-badge--${quiz.difficulty === 'mixed' ? 'medium' : quiz.difficulty}`}>
                    {quiz.difficulty}
                  </div>
                  <div className={`created-by-badge created-by-badge--${quiz.createdBy}`}>
                    {quiz.createdBy === 'ai' ? '🤖 AI' : '👤 Manual'}
                  </div>
                </div>
                
                <div className="quiz-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTakeQuiz(quiz);
                    }}
                    title="Take quiz"
                  >
                    <PlayIcon size={14} />
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditQuiz(quiz);
                    }}
                    title="Edit quiz"
                  >
                    <EditIcon size={14} />
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateQuiz(quiz);
                    }}
                    title="Duplicate quiz"
                  >
                    <CopyIcon size={14} />
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs btn--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQuiz(quiz);
                    }}
                    title="Delete quiz"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>

              <div className="quiz-card__content">
                <h3 className="quiz-card__title">{quiz.title}</h3>
                {quiz.description && (
                  <p className="quiz-card__description">
                    {quiz.description.length > 100 ? 
                      `${quiz.description.substring(0, 100)}...` : 
                      quiz.description
                    }
                  </p>
                )}

                <div className="quiz-card__stats">
                  <div className="stat">
                    <span className="stat-value">{quiz.questionCount}</span>
                    <span className="stat-label">questions</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{quiz.estimatedTime}</span>
                    <span className="stat-label">minutes</span>
                  </div>
                </div>

                {quiz.courseId && (
                  <div className="quiz-card__course">
                    {courses.find(c => c.id === quiz.courseId)?.name || 'Unknown Course'}
                  </div>
                )}
              </div>

              <div className="quiz-card__footer">
                <div className="quiz-card__date">
                  Created {formatDate(quiz.createdAt)}
                </div>

                {quiz.lastAttempt && (
                  <div className="quiz-card__last-attempt">
                    Last: {quiz.lastAttempt.score}% • {formatDate(quiz.lastAttempt.completedAt!)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Results Summary */}
      {quizPreviews.length > 0 && (
        <div className="quiz-library__summary">
          <p>
            Showing {quizPreviews.length} quiz{quizPreviews.length !== 1 ? 'es' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
      )}
    </div>
  );
}





