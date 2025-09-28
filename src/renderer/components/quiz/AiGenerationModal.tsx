import React, { useState } from 'react';
import { QuizGenerationRequest, DifficultyLevel, QuestionType } from '../../../shared/quiz';
import { useCourses } from '../../state/dashboard';
import { useAiUsageStore } from '../../state/aiUsage';
import { SparklesIcon, XIcon, UploadIcon, BookOpenIcon } from '../icons';
import AiTokenBadge from '../ui/AiTokenBadge';

interface AiGenerationModalProps {
  onClose: () => void;
  onGenerate: (request: QuizGenerationRequest) => void;
}

const QUESTION_TYPES = [
  { id: 'multiple-choice' as QuestionType, label: 'Multiple Choice' },
  { id: 'true-false' as QuestionType, label: 'True/False' },
  { id: 'fill-blank' as QuestionType, label: 'Fill in Blank' },
  { id: 'short-answer' as QuestionType, label: 'Short Answer' },
  { id: 'matching' as QuestionType, label: 'Matching' },
  { id: 'code-snippet' as QuestionType, label: 'Code Snippet' }
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy' as DifficultyLevel, label: 'Easy' },
  { value: 'medium' as DifficultyLevel, label: 'Medium' },
  { value: 'hard' as DifficultyLevel, label: 'Hard' },
  { value: 'expert' as DifficultyLevel, label: 'Expert' },
  { value: 'mixed' as const, label: 'Mixed Difficulty' }
];

export default function AiGenerationModal({ onClose, onGenerate }: AiGenerationModalProps) {
  const courses = useCourses();
  const { registerTask } = useAiUsageStore();
  
  const [request, setRequest] = useState<QuizGenerationRequest>({
    questionCount: 10,
    difficulty: 'mixed',
    questionTypes: ['multiple-choice', 'true-false'],
    timeLimit: 30
  });
  
  const [sourceMethod, setSourceMethod] = useState<'text' | 'files' | 'course'>('text');
  const [sourceText, setSourceText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [focusAreas, setFocusAreas] = useState('');
  const [avoidAreas, setAvoidAreas] = useState('');

  // Estimate token usage
  const estimateTokens = () => {
    let baseTokens = 200; // Base prompt
    baseTokens += request.questionCount * 50; // Per question
    
    if (sourceText) {
      baseTokens += Math.ceil(sourceText.length / 4); // Rough token estimate
    }
    
    if (selectedFiles.length > 0) {
      baseTokens += selectedFiles.length * 500; // Estimate per file
    }
    
    return baseTokens;
  };

  const handleGenerate = () => {
    const finalRequest: QuizGenerationRequest = {
      ...request,
      sourceText: sourceMethod === 'text' ? sourceText : undefined,
      sourceFiles: sourceMethod === 'files' ? selectedFiles : undefined,
      focusAreas: focusAreas.split(',').map(s => s.trim()).filter(s => s),
      avoidAreas: avoidAreas.split(',').map(s => s.trim()).filter(s => s)
    };

    // Register AI task for token tracking
    registerTask({
      label: 'Generate Quiz Questions',
      category: 'generate',
      tokenEstimate: estimateTokens(),
      metadata: {
        questionCount: request.questionCount,
        difficulty: request.difficulty,
        sourceMethod
      }
    });

    onGenerate(finalRequest);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const isValid = () => {
    if (sourceMethod === 'text' && !sourceText.trim()) return false;
    if (sourceMethod === 'files' && selectedFiles.length === 0) return false;
    if (sourceMethod === 'course' && !request.courseId) return false;
    return request.questionCount > 0 && request.questionCount <= 50;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-generation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">
            <SparklesIcon size={24} />
            <h2>AI Quiz Generator</h2>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="modal__content">
          {/* Source Material */}
          <div className="form-section">
            <h3>Source Material</h3>
            <p className="form-section__description">
              Choose how to provide content for AI to generate questions from
            </p>

            <div className="source-method-tabs">
              <button
                type="button"
                className={`source-tab ${sourceMethod === 'text' ? 'active' : ''}`}
                onClick={() => setSourceMethod('text')}
              >
                <BookOpenIcon size={18} />
                Paste Text
              </button>
              
              <button
                type="button"
                className={`source-tab ${sourceMethod === 'files' ? 'active' : ''}`}
                onClick={() => setSourceMethod('files')}
              >
                <UploadIcon size={18} />
                Upload Files
              </button>
              
              <button
                type="button"
                className={`source-tab ${sourceMethod === 'course' ? 'active' : ''}`}
                onClick={() => setSourceMethod('course')}
              >
                Course Materials
              </button>
            </div>

            {sourceMethod === 'text' && (
              <div className="form-group">
                <label htmlFor="source-text">Paste your content</label>
                <textarea
                  id="source-text"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste notes, textbook content, or any material you want questions generated from..."
                  className="form-textarea"
                  rows={6}
                />
                <p className="form-help">
                  {sourceText.length} characters • ~{Math.ceil(sourceText.length / 4)} tokens
                </p>
              </div>
            )}

            {sourceMethod === 'files' && (
              <div className="form-group">
                <label htmlFor="source-files">Upload files</label>
                <div className="file-upload">
                  <input
                    id="source-files"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx,.md"
                    onChange={handleFileUpload}
                    className="file-input"
                  />
                  <div className="file-upload__content">
                    <UploadIcon size={24} />
                    <p>Drop files here or click to browse</p>
                    <p className="file-upload__formats">PDF, TXT, DOCX, MD files</p>
                  </div>
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="selected-files">
                    <h5>Selected Files:</h5>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="file-item">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          className="btn btn--ghost btn--xs"
                          onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sourceMethod === 'course' && (
              <div className="form-group">
                <label htmlFor="course-select">Select course</label>
                <select
                  id="course-select"
                  value={request.courseId || ''}
                  onChange={(e) => setRequest({
                    ...request,
                    courseId: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                  className="form-select"
                >
                  <option value="">Choose a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <p className="form-help">
                  AI will use your course materials, assignments, and notes
                </p>
              </div>
            )}
          </div>

          {/* Quiz Configuration */}
          <div className="form-section">
            <h3>Quiz Configuration</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="question-count">Number of questions</label>
                <input
                  id="question-count"
                  type="number"
                  value={request.questionCount}
                  onChange={(e) => setRequest({
                    ...request,
                    questionCount: parseInt(e.target.value) || 10
                  })}
                  min="1"
                  max="50"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="difficulty">Difficulty</label>
                <select
                  id="difficulty"
                  value={request.difficulty}
                  onChange={(e) => setRequest({
                    ...request,
                    difficulty: e.target.value as any
                  })}
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
                <label htmlFor="time-limit">Time limit (minutes)</label>
                <input
                  id="time-limit"
                  type="number"
                  value={request.timeLimit}
                  onChange={(e) => setRequest({
                    ...request,
                    timeLimit: parseInt(e.target.value) || 30
                  })}
                  min="5"
                  max="180"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Question types</label>
              <div className="question-types-grid">
                {QUESTION_TYPES.map(type => (
                  <label key={type.id} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={request.questionTypes?.includes(type.id) || false}
                      onChange={(e) => {
                        const currentTypes = request.questionTypes || [];
                        if (e.target.checked) {
                          setRequest({
                            ...request,
                            questionTypes: [...currentTypes, type.id]
                          });
                        } else {
                          setRequest({
                            ...request,
                            questionTypes: currentTypes.filter(t => t !== type.id)
                          });
                        }
                      }}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="form-section">
            <h3>Advanced Options</h3>
            
            <div className="form-group">
              <label htmlFor="focus-areas">Focus areas (optional)</label>
              <input
                id="focus-areas"
                type="text"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="e.g., photosynthesis, cell division, DNA"
                className="form-input"
              />
              <p className="form-help">Comma-separated topics to emphasize</p>
            </div>

            <div className="form-group">
              <label htmlFor="avoid-areas">Avoid areas (optional)</label>
              <input
                id="avoid-areas"
                type="text"
                value={avoidAreas}
                onChange={(e) => setAvoidAreas(e.target.value)}
                placeholder="e.g., advanced calculus, quantum mechanics"
                className="form-input"
              />
              <p className="form-help">Topics to avoid in questions</p>
            </div>
          </div>

          {/* Token Usage */}
          <div className="token-usage">
            <AiTokenBadge 
              category="generate" 
              tokens={estimateTokens()} 
              label="Estimated usage"
            />
            <p className="token-usage__note">
              Actual usage may vary based on content complexity
            </p>
          </div>
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={!isValid()}
          >
            <SparklesIcon size={16} />
            Generate Quiz
          </button>
        </div>
      </div>
    </div>
  );
}





