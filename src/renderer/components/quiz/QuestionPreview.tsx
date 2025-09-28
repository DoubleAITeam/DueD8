import React from 'react';
import { Question } from '../../../shared/quiz';
import { EditIcon, ClockIcon, TargetIcon } from '../icons';

interface QuestionPreviewProps {
  question: Question;
  onEdit: () => void;
}

export default function QuestionPreview({ question, onEdit }: QuestionPreviewProps) {
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'multiple-choice':
        const mcQuestion = question as any;
        return (
          <div className="question-content question-content--multiple-choice">
            <div className="question-options">
              {mcQuestion.options.map((option: any, index: number) => (
                <div
                  key={option.id}
                  className={`question-option ${option.isCorrect ? 'question-option--correct' : ''}`}
                >
                  <div className="question-option__marker">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="question-option__text">
                    {option.text || `Option ${index + 1}`}
                  </div>
                  {option.isCorrect && (
                    <div className="question-option__indicator">✓</div>
                  )}
                </div>
              ))}
            </div>
            {mcQuestion.allowMultiple && (
              <p className="question-note">Multiple answers allowed</p>
            )}
          </div>
        );

      case 'true-false':
        const tfQuestion = question as any;
        return (
          <div className="question-content question-content--true-false">
            <div className="true-false-options">
              <div className={`true-false-option ${tfQuestion.correctAnswer === true ? 'correct' : ''}`}>
                <span className="true-false-option__marker">T</span>
                <span>True</span>
                {tfQuestion.correctAnswer === true && <span className="correct-indicator">✓</span>}
              </div>
              <div className={`true-false-option ${tfQuestion.correctAnswer === false ? 'correct' : ''}`}>
                <span className="true-false-option__marker">F</span>
                <span>False</span>
                {tfQuestion.correctAnswer === false && <span className="correct-indicator">✓</span>}
              </div>
            </div>
          </div>
        );

      case 'fill-blank':
        const fbQuestion = question as any;
        return (
          <div className="question-content question-content--fill-blank">
            <div className="fill-blank-template">
              {fbQuestion.template.split('[BLANK]').map((part: string, index: number, array: string[]) => (
                <React.Fragment key={index}>
                  {part}
                  {index < array.length - 1 && (
                    <span className="blank-placeholder">
                      [{fbQuestion.blanks[index]?.acceptedAnswers[0] || 'BLANK'}]
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="fill-blank-answers">
              <h5>Accepted Answers:</h5>
              {fbQuestion.blanks.map((blank: any, index: number) => (
                <div key={blank.id} className="blank-answers">
                  <strong>Blank {index + 1}:</strong> {blank.acceptedAnswers.join(', ')}
                  {blank.caseSensitive && <span className="case-sensitive-note">(case sensitive)</span>}
                </div>
              ))}
            </div>
          </div>
        );

      case 'short-answer':
        const saQuestion = question as any;
        return (
          <div className="question-content question-content--short-answer">
            <div className="short-answer-area">
              <textarea
                placeholder="Student answer area..."
                className="answer-textarea"
                rows={4}
                disabled
              />
              <div className="answer-constraints">
                Maximum length: {saQuestion.maxLength} characters
              </div>
            </div>
            {saQuestion.sampleAnswers.length > 0 && (
              <div className="sample-answers">
                <h5>Sample Answers:</h5>
                <ul>
                  {saQuestion.sampleAnswers.map((answer: string, index: number) => (
                    <li key={index}>{answer}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'matching':
        const matchQuestion = question as any;
        return (
          <div className="question-content question-content--matching">
            <div className="matching-columns">
              <div className="matching-column">
                <h5>Column A</h5>
                {matchQuestion.leftItems.map((item: any, index: number) => (
                  <div key={item.id} className="matching-item">
                    <span className="matching-item__number">{index + 1}</span>
                    <span className="matching-item__text">{item.text}</span>
                  </div>
                ))}
              </div>
              
              <div className="matching-column">
                <h5>Column B</h5>
                {matchQuestion.rightItems.map((item: any, index: number) => (
                  <div key={item.id} className="matching-item">
                    <span className="matching-item__letter">{String.fromCharCode(65 + index)}</span>
                    <span className="matching-item__text">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="correct-matches">
              <h5>Correct Matches:</h5>
              {matchQuestion.correctMatches.map((match: any, index: number) => {
                const leftItem = matchQuestion.leftItems.find((item: any) => item.id === match.leftId);
                const rightItem = matchQuestion.rightItems.find((item: any) => item.id === match.rightId);
                const leftIndex = matchQuestion.leftItems.indexOf(leftItem);
                const rightIndex = matchQuestion.rightItems.indexOf(rightItem);
                
                return (
                  <div key={index} className="correct-match">
                    {leftIndex + 1} → {String.fromCharCode(65 + rightIndex)}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'code-snippet':
        const codeQuestion = question as any;
        return (
          <div className="question-content question-content--code">
            <div className="code-editor">
              <div className="code-editor__header">
                <span className="code-language">{codeQuestion.language}</span>
              </div>
              <pre className="code-editor__content">
                <code>{codeQuestion.codeTemplate || '// Code area'}</code>
              </pre>
            </div>
            {codeQuestion.expectedOutput && (
              <div className="expected-output">
                <h5>Expected Output:</h5>
                <pre className="output-preview">{codeQuestion.expectedOutput}</pre>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="question-content">
            <p>Question preview not available for this type.</p>
          </div>
        );
    }
  };

  return (
    <div className="question-preview">
      <div className="question-preview__header">
        <div className="question-preview__meta">
          <div className="question-type-badge">
            {question.type.replace('-', ' ').toUpperCase()}
          </div>
          <div className={`difficulty-badge difficulty-badge--${question.difficulty}`}>
            {question.difficulty}
          </div>
          <div className="question-points">
            <TargetIcon size={14} />
            {question.points} {question.points === 1 ? 'point' : 'points'}
          </div>
          {question.timeLimit && (
            <div className="question-time">
              <ClockIcon size={14} />
              {question.timeLimit}s
            </div>
          )}
        </div>
        
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onEdit}
        >
          <EditIcon size={14} />
          Edit
        </button>
      </div>

      <div className="question-preview__content">
        <div className="question-text">
          <h3>{question.question || 'Untitled Question'}</h3>
        </div>

        {renderQuestionContent()}

        {question.explanation && (
          <div className="question-explanation">
            <h5>Explanation:</h5>
            <p>{question.explanation}</p>
          </div>
        )}

        {question.tags && question.tags.length > 0 && (
          <div className="question-tags">
            <h5>Tags:</h5>
            <div className="tag-list">
              {question.tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





