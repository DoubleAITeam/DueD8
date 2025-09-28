// Quiz & Exam Maker Types
// Comprehensive type definitions for the quiz system

export type QuestionType = 
  | 'multiple-choice'
  | 'true-false'
  | 'fill-blank'
  | 'matching'
  | 'short-answer'
  | 'code-snippet'
  | 'image-based';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type QuizMode = 
  | 'practice'        // Relaxed practice with hints
  | 'exam-simulation' // Timed, no hints, full-screen
  | 'boss-mode'       // Escalating difficulty with final boss question
  | 'live-challenge'; // Multiplayer competitive mode

// Base question interface
export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  difficulty: DifficultyLevel;
  points: number;
  timeLimit?: number; // in seconds
  explanation?: string;
  tags?: string[];
  courseId?: number;
  topicId?: string;
  createdAt: string;
  updatedAt: string;
}

// Specific question types
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  allowMultiple?: boolean;
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false';
  correctAnswer: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-blank';
  template: string; // Text with [BLANK] placeholders
  blanks: {
    id: string;
    acceptedAnswers: string[]; // Multiple acceptable answers
    caseSensitive?: boolean;
  }[];
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  leftItems: {
    id: string;
    text: string;
  }[];
  rightItems: {
    id: string;
    text: string;
  }[];
  correctMatches: {
    leftId: string;
    rightId: string;
  }[];
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer';
  sampleAnswers?: string[];
  maxLength?: number;
  rubric?: {
    criteria: string;
    points: number;
  }[];
}

export interface CodeSnippetQuestion extends BaseQuestion {
  type: 'code-snippet';
  language: string;
  codeTemplate?: string;
  expectedOutput?: string;
  testCases?: {
    input: string;
    expectedOutput: string;
  }[];
}

export interface ImageBasedQuestion extends BaseQuestion {
  type: 'image-based';
  imageUrl: string;
  imageAlt: string;
  answerType: 'multiple-choice' | 'short-answer' | 'click-regions';
  options?: MultipleChoiceQuestion['options'];
  clickRegions?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isCorrect: boolean;
  }[];
}

export type Question = 
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchingQuestion
  | ShortAnswerQuestion
  | CodeSnippetQuestion
  | ImageBasedQuestion;

// Quiz structure
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  courseId?: number;
  createdBy: 'user' | 'ai';
  questions: Question[];
  settings: QuizSettings;
  analytics: QuizAnalytics;
  createdAt: string;
  updatedAt: string;
  isTemplate?: boolean;
  templateName?: string;
}

export interface QuizSettings {
  mode: QuizMode;
  timeLimit?: number; // Total time in minutes
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showFeedback: 'immediate' | 'after-submission' | 'never';
  allowRetake?: boolean;
  maxAttempts?: number;
  passingScore?: number;
  showCorrectAnswers?: boolean;
  preventCheating?: {
    fullScreen?: boolean;
    disableCopy?: boolean;
    randomizeOrder?: boolean;
  };
}

export interface QuizAnalytics {
  totalAttempts: number;
  averageScore: number;
  averageTimeSpent: number; // in minutes
  completionRate: number;
  questionStats: {
    [questionId: string]: {
      correctCount: number;
      totalAttempts: number;
      averageTimeSpent: number;
    };
  };
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
    expert: number;
  };
}

// Quiz attempt/session
export interface QuizAttempt {
  id: string;
  quizId: string;
  userId?: string;
  startedAt: string;
  completedAt?: string;
  answers: QuizAnswer[];
  score?: number;
  timeSpent: number; // in seconds
  mode: QuizMode;
  confidenceRatings?: {
    [questionId: string]: number; // 1-5 scale
  };
  isCompleted: boolean;
  metadata?: {
    userAgent?: string;
    screenSize?: string;
    interruptions?: number;
  };
}

export interface QuizAnswer {
  questionId: string;
  answer: any; // Type varies by question type
  isCorrect?: boolean;
  timeSpent: number; // in seconds
  confidenceLevel?: number; // 1-5 scale
  submittedAt: string;
}

// AI Generation types
export interface QuizGenerationRequest {
  courseId?: number;
  topic?: string;
  sourceText?: string;
  sourceFiles?: File[];
  questionCount: number;
  questionTypes?: QuestionType[];
  difficulty?: DifficultyLevel | 'mixed';
  timeLimit?: number;
  focusAreas?: string[];
  avoidAreas?: string[];
  previousPerformance?: {
    weakAreas: string[];
    strongAreas: string[];
    averageScore: number;
  };
}

export interface QuizGenerationResponse {
  quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>;
  tokenEstimate: number;
  confidence: number; // 0-1 scale
  suggestions: string[];
  warnings?: string[];
}

// Gamification types
export interface QuizStreak {
  userId?: string;
  currentStreak: number;
  longestStreak: number;
  lastQuizDate: string;
  streakType: 'daily' | 'weekly';
}

export interface QuizXP {
  userId?: string;
  totalXP: number;
  level: number;
  xpToNextLevel: number;
  earnedToday: number;
  sources: {
    quizCompletion: number;
    perfectScores: number;
    streakBonuses: number;
    difficultyBonuses: number;
  };
}

export interface QuizAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  criteria: {
    type: 'score' | 'streak' | 'speed' | 'accuracy' | 'completion';
    threshold: number;
    timeframe?: 'session' | 'day' | 'week' | 'month' | 'all-time';
  };
  unlockedAt?: string;
}

// Live challenge types
export interface LiveChallenge {
  id: string;
  quizId: string;
  createdBy?: string;
  participants: LiveParticipant[];
  status: 'waiting' | 'active' | 'completed';
  startedAt?: string;
  completedAt?: string;
  maxParticipants?: number;
  settings: {
    allowLateJoin?: boolean;
    showLeaderboard?: boolean;
    timeLimit?: number;
  };
}

export interface LiveParticipant {
  userId?: string;
  displayName: string;
  joinedAt: string;
  currentQuestion?: number;
  score: number;
  isFinished: boolean;
  progress: {
    questionsAnswered: number;
    totalQuestions: number;
    timeSpent: number;
  };
}

// Study insights and recommendations
export interface StudyInsight {
  type: 'weakness' | 'strength' | 'improvement' | 'recommendation';
  title: string;
  description: string;
  data: {
    subject?: string;
    accuracy?: number;
    timeSpent?: number;
    difficulty?: DifficultyLevel;
    trend?: 'improving' | 'declining' | 'stable';
  };
  actionable: {
    suggestion: string;
    resources?: {
      type: 'flashcards' | 'notes' | 'quiz' | 'external';
      title: string;
      url?: string;
    }[];
  };
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

// Export utility types
export type QuestionStats = {
  totalQuestions: number;
  byType: Record<QuestionType, number>;
  byDifficulty: Record<DifficultyLevel, number>;
  averagePoints: number;
  estimatedTime: number;
};

export type QuizPreview = Pick<Quiz, 'id' | 'title' | 'description' | 'courseId' | 'createdBy' | 'createdAt'> & {
  questionCount: number;
  estimatedTime: number;
  difficulty: DifficultyLevel | 'mixed';
  lastAttempt?: Pick<QuizAttempt, 'completedAt' | 'score'>;
};





