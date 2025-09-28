// Flashcards System Types
// Comprehensive type definitions for the flashcard system

export type FlashcardType = 
  | 'basic'           // Front/back cards
  | 'cloze'           // Fill-in-the-blank with hidden text
  | 'image'           // Image on front, text on back
  | 'reverse'         // Can be studied in both directions
  | 'multiple-choice' // Show options on back for self-testing
  | 'type-answer';    // Type the answer instead of just flipping

export type StudyMode = 
  | 'classic-flip'    // Traditional flip cards
  | 'multiple-choice' // Show options to choose from
  | 'type-answer'     // Type the correct answer
  | 'cloze'           // Fill in the blanks
  | 'smart-mix';      // Adaptive mix of modes

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5; // 1 = Again, 5 = Perfect

// Base flashcard interface
export interface Flashcard {
  id: string;
  deckId: string;
  type: FlashcardType;
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  imageUrl?: string;
  imageAlt?: string;
  
  // Spaced repetition data
  interval: number;           // Days until next review
  repetitions: number;        // Number of successful reviews
  easeFactor: number;         // Ease factor for spaced repetition (1.3-2.5)
  nextReviewDate: string;     // ISO date string
  lastReviewedAt?: string;    // ISO date string
  
  // Study tracking
  studyCount: number;         // Total times studied
  correctCount: number;       // Times answered correctly
  averageResponseTime: number; // Average time to answer in ms
  lastConfidence?: ConfidenceLevel;
  
  // Metadata
  tags: string[];
  difficulty?: DifficultyLevel;
  courseId?: number;
  topicId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: 'user' | 'ai';
  
  // Multiple choice specific
  options?: string[];         // For multiple choice cards
  correctOptionIndex?: number;
  
  // Cloze specific
  clozeText?: string;         // Text with {{c1::hidden}} syntax
  clozeFields?: {
    id: string;
    text: string;
    hint?: string;
  }[];
}

// Deck structure
export interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  color?: string;             // Hex color for deck theming
  icon?: string;              // Icon name for deck
  
  // Organization
  courseId?: number;
  topicId?: string;
  tags: string[];
  category: 'class' | 'topic' | 'general';
  
  // Cards
  cardCount: number;
  cards: Flashcard[];
  
  // Study settings
  settings: DeckSettings;
  
  // Progress tracking
  analytics: DeckAnalytics;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastStudiedAt?: string;
  createdBy: 'user' | 'ai';
  isShared?: boolean;
  isTemplate?: boolean;
}

export interface DeckSettings {
  // Study behavior
  defaultStudyMode: StudyMode;
  enabledStudyModes: StudyMode[];
  showHints: boolean;
  autoAdvance: boolean;
  autoAdvanceDelay: number;   // seconds
  
  // Spaced repetition
  enableSpacedRepetition: boolean;
  maxNewCardsPerDay: number;
  maxReviewCardsPerDay: number;
  
  // Display
  shuffleCards: boolean;
  showProgress: boolean;
  playSounds: boolean;
  
  // Difficulty
  graduatingInterval: number;  // days
  easyInterval: number;        // days
  hardInterval: number;        // multiplier
}

export interface DeckAnalytics {
  // Usage stats
  totalStudySessions: number;
  totalTimeSpent: number;     // minutes
  averageSessionTime: number; // minutes
  lastSessionDate?: string;
  
  // Performance
  overallAccuracy: number;    // 0-1
  averageConfidence: number;  // 1-5
  masteredCards: number;      // Cards with high ease factor
  strugglingCards: number;    // Cards with low ease factor
  
  // Progress
  cardsLearned: number;       // Cards seen at least once
  cardsReviewed: number;      // Cards due for review today
  cardsDue: number;           // Cards overdue for review
  newCardsToday: number;      // New cards studied today
  
  // Trends
  accuracyTrend: 'improving' | 'declining' | 'stable';
  studyStreak: number;        // consecutive days studied
  longestStreak: number;
  
  // Per-card stats
  cardStats: {
    [cardId: string]: {
      accuracy: number;
      averageTime: number;
      lastReviewed?: string;
      timesReviewed: number;
    };
  };
}

// Study session
export interface StudySession {
  id: string;
  deckId: string;
  mode: StudyMode;
  startedAt: string;
  completedAt?: string;
  
  // Cards in session
  cards: Flashcard[];
  currentCardIndex: number;
  
  // Responses
  responses: StudyResponse[];
  
  // Session settings
  settings: {
    maxCards?: number;
    timeLimit?: number;        // minutes
    includeNewCards: boolean;
    includeReviewCards: boolean;
    shuffled: boolean;
  };
  
  // Progress
  isCompleted: boolean;
  score?: number;             // 0-100
  timeSpent: number;          // seconds
  
  // Results
  summary?: {
    totalCards: number;
    correctAnswers: number;
    averageResponseTime: number;
    newCardsLearned: number;
    cardsReviewed: number;
    difficultyBreakdown: Record<DifficultyLevel, number>;
  };
}

export interface StudyResponse {
  cardId: string;
  answer: string;
  isCorrect: boolean;
  confidence: ConfidenceLevel;
  responseTime: number;       // milliseconds
  mode: StudyMode;
  timestamp: string;
  
  // Multiple choice specific
  selectedOption?: number;
  availableOptions?: string[];
  
  // Type answer specific
  expectedAnswer?: string;
  similarity?: number;        // 0-1 for fuzzy matching
}

// AI Generation types
export interface FlashcardGenerationRequest {
  // Source content
  sourceText?: string;
  sourceFiles?: File[];
  sourceUrl?: string;         // For YouTube, articles, etc.
  
  // Target deck
  deckTitle?: string;
  deckDescription?: string;
  courseId?: number;
  topicId?: string;
  
  // Generation settings
  cardCount: number;
  cardTypes: FlashcardType[];
  difficulty: DifficultyLevel | 'mixed';
  includeImages?: boolean;
  includeHints?: boolean;
  
  // Content focus
  focusAreas?: string[];
  avoidAreas?: string[];
  keyTermsOnly?: boolean;
  includeExamples?: boolean;
  
  // Previous performance (for adaptive generation)
  weakAreas?: string[];
  strongAreas?: string[];
  previousAccuracy?: number;
}

export interface FlashcardGenerationResponse {
  cards: Omit<Flashcard, 'id' | 'deckId' | 'createdAt' | 'updatedAt'>[];
  deckMetadata: {
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedTags: string[];
    difficulty: DifficultyLevel;
  };
  tokenEstimate: number;
  confidence: number;         // 0-1 scale
  suggestions: string[];
  warnings?: string[];
  metadata: {
    sourceLength: number;
    extractedConcepts: number;
    generationTime: number;
  };
}

// Import/Export types
export interface FlashcardImport {
  type: 'csv' | 'anki' | 'quizlet' | 'text' | 'pdf' | 'image';
  file: File;
  settings: {
    delimiter?: string;         // For CSV
    frontColumn?: string;       // CSV column mapping
    backColumn?: string;
    hasHeaders?: boolean;
    encoding?: string;
    
    // OCR settings for images/PDFs
    ocrLanguage?: string;
    extractTables?: boolean;
    extractImages?: boolean;
  };
}

export interface FlashcardExport {
  format: 'csv' | 'anki' | 'json' | 'pdf';
  deckIds: string[];
  settings: {
    includeProgress?: boolean;
    includeImages?: boolean;
    includeMetadata?: boolean;
    
    // PDF specific
    cardsPerPage?: number;
    includeAnswers?: boolean;
    printFriendly?: boolean;
  };
}

// Search and filtering
export interface FlashcardFilter {
  query?: string;
  courseId?: number;
  tags?: string[];
  difficulty?: DifficultyLevel[];
  cardType?: FlashcardType[];
  dueStatus?: 'due' | 'overdue' | 'new' | 'learned';
  lastStudied?: 'today' | 'week' | 'month' | 'never';
  accuracy?: 'high' | 'medium' | 'low';
  createdBy?: 'user' | 'ai';
  sortBy?: 'title' | 'created' | 'lastStudied' | 'accuracy' | 'difficulty';
  sortOrder?: 'asc' | 'desc';
}

// Achievements and gamification
export interface FlashcardAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  criteria: {
    type: 'streak' | 'accuracy' | 'speed' | 'volume' | 'mastery';
    threshold: number;
    timeframe?: 'session' | 'day' | 'week' | 'month' | 'all-time';
  };
  unlockedAt?: string;
  progress?: number;          // 0-1 for progress towards unlocking
}

export interface FlashcardStreak {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;
  streakType: 'daily' | 'weekly';
  freezesUsed: number;        // Streak freeze days used
  freezesAvailable: number;
}

// Study insights and recommendations
export interface StudyInsight {
  type: 'weakness' | 'strength' | 'recommendation' | 'milestone';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  
  data: {
    deckId?: string;
    accuracy?: number;
    timeSpent?: number;
    cardCount?: number;
    trend?: 'improving' | 'declining' | 'stable';
  };
  
  actionable: {
    suggestion: string;
    action?: 'study-deck' | 'review-cards' | 'create-cards' | 'adjust-settings';
    targetDeckId?: string;
    targetCardIds?: string[];
  };
  
  createdAt: string;
  seenAt?: string;
  dismissedAt?: string;
}

// Utility types
export type DeckPreview = Pick<FlashcardDeck, 'id' | 'title' | 'description' | 'color' | 'icon' | 'cardCount' | 'category' | 'lastStudiedAt'> & {
  dueCards: number;
  newCards: number;
  accuracy: number;
  nextReviewDate?: string;
};

export type CardPreview = Pick<Flashcard, 'id' | 'type' | 'front' | 'difficulty' | 'tags'> & {
  isDue: boolean;
  isNew: boolean;
  accuracy: number;
  nextReview?: string;
};

// Spaced repetition algorithm types
export interface SpacedRepetitionResult {
  newInterval: number;
  newRepetitions: number;
  newEaseFactor: number;
  nextReviewDate: string;
  wasCorrect: boolean;
}

export interface SpacedRepetitionSettings {
  // Algorithm parameters
  startingEaseFactor: number;     // Default 2.5
  minimumEaseFactor: number;      // Default 1.3
  maximumEaseFactor: number;      // Default 2.5
  easyBonus: number;              // Default 1.3
  hardPenalty: number;            // Default 1.2
  
  // Intervals
  learningSteps: number[];        // [1, 10] minutes
  graduatingInterval: number;     // 1 day
  easyInterval: number;           // 4 days
  maximumInterval: number;        // 36500 days (100 years)
  
  // Limits
  newCardsPerDay: number;
  maximumReviewsPerDay: number;
  
  // Behavior
  burySiblings: boolean;          // Don't show related cards in same session
  showNextReviewTime: boolean;
}





