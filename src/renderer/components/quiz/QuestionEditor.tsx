import React, { useState, useEffect } from 'react';
import { Question, QuestionType, DifficultyLevel } from '../../../shared/quiz';
import { PlusIcon, TrashIcon, CheckIcon, XIcon } from '../icons';

interface QuestionEditorProps {
  question: Question;
  onSave: (updates: Partial<Question>) => void;
  onCancel: () => void;
}

const DIFFICULTY_OPTIONS = [
  { value: 'easy' as DifficultyLevel, label: 'Easy', color: 'green' },
  { value: 'medium' as DifficultyLevel, label: 'Medium', color: 'yellow' },
  { value: 'hard' as DifficultyLevel, label: 'Hard', color: 'orange' },
  { value: 'expert' as DifficultyLevel, label: 'Expert', color: 'red' }
];

export default function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [formData, setFormData] = useState({
    question: question.question,
    difficulty: question.difficulty,
    points: question.points,
    timeLimit: question.timeLimit || 60,
    explanation: question.explanation || '',
    tags: question.tags || []
  });

  const [typeSpecificData, setTypeSpecificData] = useState<any>(null);

  useEffect(() => {
    // Initialize type-specific data based on question type
    switch (question.type) {
      case 'multiple-choice':
        setTypeSpecificData({
          options: (question as any).options || [],
          allowMultiple: (question as any).allowMultiple || false
        });
        break;
      case 'true-false':
        setTypeSpecificData({
          correctAnswer: (question as any).correctAnswer ?? true
        });
        break;
      case 'fill-blank':
        setTypeSpecificData({
          template: (question as any).template || '',
          blanks: (question as any).blanks || []
        });
        break;
      case 'short-answer':
        setTypeSpecificData({
          sampleAnswers: (question as any).sampleAnswers || [],
          maxLength: (question as any).maxLength || 500
        });
        break;
      case 'matching':
        setTypeSpecificData({
          leftItems: (question as any).leftItems || [],
          rightItems: (question as any).rightItems || [],
          correctMatches: (question as any).correctMatches || []
        });
        break;
      case 'code-snippet':
        setTypeSpecificData({
          language: (question as any).language || 'javascript',
          codeTemplate: (question as any).codeTemplate || '',
          expectedOutput: (question as any).expectedOutput || ''
        });
        break;
    }
  }, [question]);

  const handleSave = () => {
    const updates = {
      ...formData,
      ...typeSpecificData,
      updatedAt: new Date().toISOString()
    };
    onSave(updates);
  };

  const renderTypeSpecificEditor = () => {
    if (!typeSpecificData) return null;

    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="question-editor__section">
            <h4>Answer Options</h4>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={typeSpecificData.allowMultiple}
                  onChange={(e) => setTypeSpecificData({
                    ...typeSpecificData,
                    allowMultiple: e.target.checked
                  })}
                />
                Allow multiple correct answers
              </label>
            </div>

            <div className="multiple-choice-options">
              {typeSpecificData.options.map((option: any, index: number) => (
                <div key={option.id} className="option-editor">
                  <div className="option-editor__marker">
                    <input
                      type={typeSpecificData.allowMultiple ? 'checkbox' : 'radio'}
                      name="correct-answer"
                      checked={option.isCorrect}
                      onChange={(e) => {
                        const newOptions = [...typeSpecificData.options];
                        if (!typeSpecificData.allowMultiple) {
                          // Single selection - uncheck all others
                          newOptions.forEach(opt => opt.isCorrect = false);
                        }
                        newOptions[index].isCorrect = e.target.checked;
                        setTypeSpecificData({
                          ...typeSpecificData,
                          options: newOptions
                        });
                      }}
                    />
                  </div>
                  
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...typeSpecificData.options];
                      newOptions[index].text = e.target.value;
                      setTypeSpecificData({
                        ...typeSpecificData,
                        options: newOptions
                      });
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="form-input"
                  />
                  
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => {
                      const newOptions = typeSpecificData.options.filter((_: any, i: number) => i !== index);
                      setTypeSpecificData({
                        ...typeSpecificData,
                        options: newOptions
                      });
                    }}
                    disabled={typeSpecificData.options.length <= 2}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  const newOption = {
                    id: `option-${Date.now()}`,
                    text: '',
                    isCorrect: false
                  };
                  setTypeSpecificData({
                    ...typeSpecificData,
                    options: [...typeSpecificData.options, newOption]
                  });
                }}
              >
                <PlusIcon size={14} />
                Add Option
              </button>
            </div>
          </div>
        );

      case 'true-false':
        return (
          <div className="question-editor__section">
            <h4>Correct Answer</h4>
            <div className="true-false-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="true-false"
                  checked={typeSpecificData.correctAnswer === true}
                  onChange={() => setTypeSpecificData({
                    ...typeSpecificData,
                    correctAnswer: true
                  })}
                />
                True
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="true-false"
                  checked={typeSpecificData.correctAnswer === false}
                  onChange={() => setTypeSpecificData({
                    ...typeSpecificData,
                    correctAnswer: false
                  })}
                />
                False
              </label>
            </div>
          </div>
        );

      case 'fill-blank':
        return (
          <div className="question-editor__section">
            <h4>Fill in the Blank</h4>
            
            <div className="form-group">
              <label>Template (use [BLANK] for blanks)</label>
              <textarea
                value={typeSpecificData.template}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  template: e.target.value
                })}
                placeholder="The [BLANK] is important because [BLANK]."
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="blanks-editor">
              <h5>Blank Answers</h5>
              {typeSpecificData.blanks.map((blank: any, index: number) => (
                <div key={blank.id} className="blank-editor">
                  <label>Blank {index + 1} - Accepted Answers (comma separated)</label>
                  <input
                    type="text"
                    value={blank.acceptedAnswers.join(', ')}
                    onChange={(e) => {
                      const newBlanks = [...typeSpecificData.blanks];
                      newBlanks[index].acceptedAnswers = e.target.value.split(',').map(s => s.trim());
                      setTypeSpecificData({
                        ...typeSpecificData,
                        blanks: newBlanks
                      });
                    }}
                    placeholder="answer1, answer2, answer3"
                    className="form-input"
                  />
                  
                  <label>
                    <input
                      type="checkbox"
                      checked={blank.caseSensitive}
                      onChange={(e) => {
                        const newBlanks = [...typeSpecificData.blanks];
                        newBlanks[index].caseSensitive = e.target.checked;
                        setTypeSpecificData({
                          ...typeSpecificData,
                          blanks: newBlanks
                        });
                      }}
                    />
                    Case sensitive
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'short-answer':
        return (
          <div className="question-editor__section">
            <h4>Short Answer Settings</h4>
            
            <div className="form-group">
              <label>Maximum Length (characters)</label>
              <input
                type="number"
                value={typeSpecificData.maxLength}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  maxLength: parseInt(e.target.value) || 500
                })}
                className="form-input"
                min="50"
                max="2000"
              />
            </div>

            <div className="form-group">
              <label>Sample Answers (optional, for reference)</label>
              <textarea
                value={typeSpecificData.sampleAnswers.join('\n')}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  sampleAnswers: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="Enter sample answers, one per line"
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>
        );

      case 'code-snippet':
        return (
          <div className="question-editor__section">
            <h4>Code Question Settings</h4>
            
            <div className="form-group">
              <label>Programming Language</label>
              <select
                value={typeSpecificData.language}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  language: e.target.value
                })}
                className="form-select"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
              </select>
            </div>

            <div className="form-group">
              <label>Code Template (optional)</label>
              <textarea
                value={typeSpecificData.codeTemplate}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  codeTemplate: e.target.value
                })}
                placeholder="// Starting code for students"
                className="form-textarea code-textarea"
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>Expected Output (optional)</label>
              <textarea
                value={typeSpecificData.expectedOutput}
                onChange={(e) => setTypeSpecificData({
                  ...typeSpecificData,
                  expectedOutput: e.target.value
                })}
                placeholder="Expected program output"
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="question-editor">
      <div className="question-editor__header">
        <h3>Edit Question</h3>
        <div className="question-editor__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onCancel}
          >
            <XIcon size={16} />
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSave}
          >
            <CheckIcon size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="question-editor__form">
        {/* Basic Question Settings */}
        <div className="question-editor__section">
          <h4>Question Details</h4>
          
          <div className="form-group">
            <label>Question Text *</label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="Enter your question here..."
              className="form-textarea"
              rows={3}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as DifficultyLevel })}
                className="form-select"
              >
                {DIFFICULTY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Points</label>
              <input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 1 })}
                className="form-input"
                min="1"
                max="10"
              />
            </div>

            <div className="form-group">
              <label>Time Limit (seconds)</label>
              <input
                type="number"
                value={formData.timeLimit}
                onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 60 })}
                className="form-input"
                min="15"
                max="300"
              />
            </div>
          </div>
        </div>

        {/* Type-specific editor */}
        {renderTypeSpecificEditor()}

        {/* Additional Settings */}
        <div className="question-editor__section">
          <h4>Additional Settings</h4>
          
          <div className="form-group">
            <label>Explanation (shown after answer)</label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Optional explanation for the correct answer..."
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags.join(', ')}
              onChange={(e) => setFormData({ 
                ...formData, 
                tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
              })}
              placeholder="topic1, concept2, chapter3"
              className="form-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}





