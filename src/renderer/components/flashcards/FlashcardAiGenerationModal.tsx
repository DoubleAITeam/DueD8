import React, { useState } from 'react';
import { FlashcardGenerationRequest, DifficultyLevel, FlashcardType } from '../../../shared/flashcards';
import { useCourses } from '../../state/dashboard';
import { useAiUsageStore } from '../../state/aiUsage';
import { SparklesIcon, XIcon, UploadIcon, BookOpenIcon, FlashcardIcon, ImageIcon } from '../icons';
import AiTokenBadge from '../ui/AiTokenBadge';

interface FlashcardAiGenerationModalProps {
  onClose: () => void;
  onGenerate: (request: FlashcardGenerationRequest) => void;
}

const FLASHCARD_TYPES = [
  { id: 'basic' as FlashcardType, label: 'Basic (Front/Back)' },
  { id: 'cloze' as FlashcardType, label: 'Cloze Deletion' },
  { id: 'reverse' as FlashcardType, label: 'Reversible Cards' },
  { id: 'multiple-choice' as FlashcardType, label: 'Multiple Choice' },
  { id: 'type-answer' as FlashcardType, label: 'Type Answer' },
  { id: 'image' as FlashcardType, label: 'Image Cards' }
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy' as DifficultyLevel, label: 'Easy' },
  { value: 'medium' as DifficultyLevel, label: 'Medium' },
  { value: 'hard' as DifficultyLevel, label: 'Hard' },
  { value: 'expert' as DifficultyLevel, label: 'Expert' },
  { value: 'mixed' as const, label: 'Mixed Difficulty' }
];

export default function FlashcardAiGenerationModal({ onClose, onGenerate }: FlashcardAiGenerationModalProps) {
  const courses = useCourses();
  const { registerTask } = useAiUsageStore();
  
  const [request, setRequest] = useState<FlashcardGenerationRequest>({
    cardCount: 20,
    difficulty: 'mixed',
    cardTypes: ['basic', 'cloze'],
    includeHints: true,
    includeImages: false
  });
  
  const [sourceMethod, setSourceMethod] = useState<'text' | 'files' | 'course' | 'url'>('text');
  const [sourceText, setSourceText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [avoidAreas, setAvoidAreas] = useState('');
  const [keyTermsOnly, setKeyTermsOnly] = useState(false);
  const [includeExamples, setIncludeExamples] = useState(true);

  // Estimate token usage
  const estimateTokens = () => {
    let baseTokens = 300; // Base prompt for flashcards
    baseTokens += request.cardCount * 40; // Per card (less than quiz questions)
    
    if (sourceText) {
      baseTokens += Math.ceil(sourceText.length / 4); // Rough token estimate
    }
    
    if (selectedFiles.length > 0) {
      baseTokens += selectedFiles.length * 600; // Estimate per file
    }
    
    if (sourceUrl) {
      baseTokens += 800; // Estimate for web content extraction
    }
    
    if (request.includeImages) {
      baseTokens += request.cardCount * 20; // Extra for image generation/processing
    }
    
    return baseTokens;
  };

  const handleGenerate = () => {
    const finalRequest: FlashcardGenerationRequest = {
      ...request,
      sourceText: sourceMethod === 'text' ? sourceText : undefined,
      sourceFiles: sourceMethod === 'files' ? selectedFiles : undefined,
      sourceUrl: sourceMethod === 'url' ? sourceUrl : undefined,
      focusAreas: focusAreas.split(',').map(s => s.trim()).filter(s => s),
      avoidAreas: avoidAreas.split(',').map(s => s.trim()).filter(s => s),
      keyTermsOnly,
      includeExamples
    };

    // Register AI task for token tracking
    registerTask({
      label: 'Generate Flashcards',
      category: 'generate',
      tokenEstimate: estimateTokens(),
      metadata: {
        cardCount: request.cardCount,
        difficulty: request.difficulty,
        sourceMethod,
        cardTypes: request.cardTypes
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
    if (sourceMethod === 'url' && !sourceUrl.trim()) return false;
    return request.cardCount > 0 && request.cardCount <= 100 && request.cardTypes.length > 0;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-generation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">
            <SparklesIcon size={24} />
            <h2>AI Flashcard Generator</h2>
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
              Choose how to provide content for AI to generate flashcards from
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
                className={`source-tab ${sourceMethod === 'url' ? 'active' : ''}`}
                onClick={() => setSourceMethod('url')}
              >
                Web Content
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
                  placeholder="Paste notes, textbook content, lecture transcripts, or any material you want flashcards generated from..."
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
                    accept=".pdf,.txt,.docx,.md,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="file-input"
                  />
                  <div className="file-upload__content">
                    <UploadIcon size={24} />
                    <p>Drop files here or click to browse</p>
                    <p className="file-upload__formats">PDF, TXT, DOCX, MD, Images</p>
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

            {sourceMethod === 'url' && (
              <div className="form-group">
                <label htmlFor="source-url">Web URL</label>
                <input
                  id="source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/article or YouTube video URL"
                  className="form-input"
                />
                <p className="form-help">
                  Supports articles, Wikipedia pages, and YouTube videos
                </p>
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

          {/* Deck Configuration */}
          <div className="form-section">
            <h3>Deck Configuration</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="deck-title">Deck title (optional)</label>
                <input
                  id="deck-title"
                  type="text"
                  value={request.deckTitle || ''}
                  onChange={(e) => setRequest({
                    ...request,
                    deckTitle: e.target.value
                  })}
                  placeholder="e.g., Biology Chapter 5"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="card-count">Number of cards</label>
                <input
                  id="card-count"
                  type="number"
                  value={request.cardCount}
                  onChange={(e) => setRequest({
                    ...request,
                    cardCount: parseInt(e.target.value) || 20
                  })}
                  min="1"
                  max="100"
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
            </div>

            <div className="form-group">
              <label>Flashcard types</label>
              <div className="flashcard-types-grid">
                {FLASHCARD_TYPES.map(type => (
                  <label key={type.id} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={request.cardTypes?.includes(type.id) || false}
                      onChange={(e) => {
                        const currentTypes = request.cardTypes || [];
                        if (e.target.checked) {
                          setRequest({
                            ...request,
                            cardTypes: [...currentTypes, type.id]
                          });
                        } else {
                          setRequest({
                            ...request,
                            cardTypes: currentTypes.filter(t => t !== type.id)
                          });
                        }
                      }}
                    />
                    <FlashcardIcon size={16} />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="deck-description">Description (optional)</label>
              <textarea
                id="deck-description"
                value={request.deckDescription || ''}
                onChange={(e) => setRequest({
                  ...request,
                  deckDescription: e.target.value
                })}
                placeholder="Brief description of what these flashcards cover..."
                className="form-textarea"
                rows={2}
              />
            </div>
          </div>

          {/* Advanced Options */}
          <div className="form-section">
            <h3>Advanced Options</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="focus-areas">Focus areas (optional)</label>
                <input
                  id="focus-areas"
                  type="text"
                  value={focusAreas}
                  onChange={(e) => setFocusAreas(e.target.value)}
                  placeholder="e.g., key terms, definitions, formulas"
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
                  placeholder="e.g., complex calculations, dates"
                  className="form-input"
                />
                <p className="form-help">Topics to avoid in flashcards</p>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={keyTermsOnly}
                  onChange={(e) => setKeyTermsOnly(e.target.checked)}
                />
                Focus on key terms and definitions only
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeExamples}
                  onChange={(e) => setIncludeExamples(e.target.checked)}
                />
                Include examples and applications
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={request.includeHints || false}
                  onChange={(e) => setRequest({
                    ...request,
                    includeHints: e.target.checked
                  })}
                />
                Generate hints for difficult cards
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={request.includeImages || false}
                  onChange={(e) => setRequest({
                    ...request,
                    includeImages: e.target.checked
                  })}
                />
                <ImageIcon size={16} />
                Include relevant images (when possible)
              </label>
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
              Actual usage may vary based on content complexity and card types
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
            Generate Flashcards
          </button>
        </div>
      </div>
    </div>
  );
}





