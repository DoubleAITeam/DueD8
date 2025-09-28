import React, { useState } from 'react';
import { useQuizCreation } from '../../state/quiz';
import { Question, QuestionType, DifficultyLevel } from '../../../shared/quiz';
import { PlusIcon, TrashIcon, CopyIcon, GripVerticalIcon } from '../icons';
import QuestionEditor from './QuestionEditor';
import QuestionPreview from './QuestionPreview';

const QUESTION_TYPES = [
  { id: 'multiple-choice' as QuestionType, label: 'Multiple Choice', icon: '⚪' },
  { id: 'true-false' as QuestionType, label: 'True/False', icon: '✓' },
  { id: 'fill-blank' as QuestionType, label: 'Fill in the Blank', icon: '___' },
  { id: 'short-answer' as QuestionType, label: 'Short Answer', icon: '📝' },
  { id: 'matching' as QuestionType, label: 'Matching', icon: '🔗' },
  { id: 'code-snippet' as QuestionType, label: 'Code Snippet', icon: '</>' }
];

export default function QuizQuestionsStep() {
  const { 
    currentQuestions, 
    addQuestion, 
    updateQuestion, 
    removeQuestion, 
    duplicateQuestion,
    reorderQuestions,
    setCreationStep 
  } = useQuizCreation();
  
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState(false);

  const createNewQuestion = (type: QuestionType) => {
    const baseQuestion = {
      id: `question-${Date.now()}`,
      type,
      question: '',
      difficulty: 'medium' as DifficultyLevel,
      points: 1,
      explanation: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let newQuestion: Question;

    switch (type) {
      case 'multiple-choice':
        newQuestion = {
          ...baseQuestion,
          type: 'multiple-choice',
          options: [
            { id: 'option-1', text: '', isCorrect: true },
            { id: 'option-2', text: '', isCorrect: false },
            { id: 'option-3', text: '', isCorrect: false },
            { id: 'option-4', text: '', isCorrect: false }
          ]
        };
        break;
      case 'true-false':
        newQuestion = {
          ...baseQuestion,
          type: 'true-false',
          correctAnswer: true
        };
        break;
      case 'fill-blank':
        newQuestion = {
          ...baseQuestion,
          type: 'fill-blank',
          template: 'The [BLANK] is an important concept.',
          blanks: [
            { id: 'blank-1', acceptedAnswers: ['answer'], caseSensitive: false }
          ]
        };
        break;
      case 'short-answer':
        newQuestion = {
          ...baseQuestion,
          type: 'short-answer',
          sampleAnswers: [],
          maxLength: 500
        };
        break;
      case 'matching':
        newQuestion = {
          ...baseQuestion,
          type: 'matching',
          leftItems: [
            { id: 'left-1', text: '' },
            { id: 'left-2', text: '' }
          ],
          rightItems: [
            { id: 'right-1', text: '' },
            { id: 'right-2', text: '' }
          ],
          correctMatches: [
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-2', rightId: 'right-2' }
          ]
        };
        break;
      case 'code-snippet':
        newQuestion = {
          ...baseQuestion,
          type: 'code-snippet',
          language: 'javascript',
          codeTemplate: '// Write your code here\n',
          expectedOutput: ''
        };
        break;
      default:
        return;
    }

    addQuestion(newQuestion);
    setEditingQuestionId(newQuestion.id);
    setShowQuestionTypeMenu(false);
  };

  const handleQuestionSave = (questionId: string, updates: Partial<Question>) => {
    updateQuestion(questionId, updates);
    setEditingQuestionId(null);
  };

  const handleQuestionCancel = () => {
    setEditingQuestionId(null);
  };

  const handleNext = () => {
    setCreationStep('settings');
  };

  const handlePrevious = () => {
    setCreationStep('setup');
  };

  const isValid = currentQuestions.length > 0 && currentQuestions.every(q => q.question.trim().length > 0);

  return (
    <div className="quiz-questions">
      <div className="quiz-questions__header">
        <h2>Quiz Questions</h2>
        <p>Add and configure questions for your quiz</p>
      </div>

      <div className="quiz-questions__content">
        <div className="quiz-questions__sidebar">
          {/* Add Question Button */}
          <div className="add-question">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => setShowQuestionTypeMenu(!showQuestionTypeMenu)}
            >
              <PlusIcon size={18} />
              Add Question
            </button>

            {showQuestionTypeMenu && (
              <div className="question-type-menu">
                {QUESTION_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className="question-type-option"
                    onClick={() => createNewQuestion(type.id)}
                  >
                    <span className="question-type-option__icon">{type.icon}</span>
                    <span className="question-type-option__label">{type.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Questions List */}
          <div className="questions-list">
            <h3>Questions ({currentQuestions.length})</h3>
            
            {currentQuestions.length === 0 ? (
              <div className="questions-list__empty">
                <p>No questions yet. Click "Add Question" to get started.</p>
              </div>
            ) : (
              <div className="questions-list__items">
                {currentQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className={`question-list-item ${selectedQuestionId === question.id ? 'selected' : ''} ${editingQuestionId === question.id ? 'editing' : ''}`}
                  >
                    <div className="question-list-item__drag-handle">
                      <GripVerticalIcon size={14} />
                    </div>
                    
                    <div 
                      className="question-list-item__content"
                      onClick={() => setSelectedQuestionId(question.id)}
                    >
                      <div className="question-list-item__header">
                        <span className="question-number">Q{index + 1}</span>
                        <span className={`difficulty-badge difficulty-badge--${question.difficulty}`}>
                          {question.difficulty}
                        </span>
                      </div>
                      
                      <div className="question-list-item__preview">
                        {question.question || 'Untitled Question'}
                      </div>
                      
                      <div className="question-list-item__meta">
                        <span className="question-type">{QUESTION_TYPES.find(t => t.id === question.type)?.label}</span>
                        <span className="question-points">{question.points} pts</span>
                      </div>
                    </div>

                    <div className="question-list-item__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditingQuestionId(question.id)}
                        title="Edit question"
                      >
                        ✏️
                      </button>
                      
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => duplicateQuestion(question.id)}
                        title="Duplicate question"
                      >
                        <CopyIcon size={14} />
                      </button>
                      
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn--danger"
                        onClick={() => removeQuestion(question.id)}
                        title="Delete question"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="quiz-questions__main">
          {editingQuestionId ? (
            <QuestionEditor
              question={currentQuestions.find(q => q.id === editingQuestionId)!}
              onSave={(updates) => handleQuestionSave(editingQuestionId, updates)}
              onCancel={handleQuestionCancel}
            />
          ) : selectedQuestionId ? (
            <QuestionPreview
              question={currentQuestions.find(q => q.id === selectedQuestionId)!}
              onEdit={() => setEditingQuestionId(selectedQuestionId)}
            />
          ) : (
            <div className="quiz-questions__placeholder">
              <div className="placeholder-content">
                <h3>Select a question to preview</h3>
                <p>Click on a question from the list to see a preview, or add your first question to get started.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="quiz-questions__navigation">
        <div className="quiz-questions__progress">
          Step 2 of 4 • {currentQuestions.length} questions
        </div>
        
        <div className="quiz-questions__nav-buttons">
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
            disabled={!isValid}
          >
            Continue to Settings
          </button>
        </div>
      </div>
    </div>
  );
}





