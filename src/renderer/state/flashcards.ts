import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  FlashcardDeck, 
  Flashcard, 
  StudySession, 
  StudyResponse, 
  FlashcardGenerationRequest,
  FlashcardFilter,
  StudyMode,
  DifficultyLevel,
  ConfidenceLevel,
  FlashcardType,
  SpacedRepetitionResult,
  DeckPreview,
  CardPreview,
  StudyInsight,
  FlashcardStreak
} from '../../shared/flashcards';

// Flashcard creation and management state
export interface FlashcardCreationState {
  // Current deck being created/edited
  currentDeck: Partial<FlashcardDeck> | null;
  currentCards: Flashcard[];
  
  // Creation flow state
  creationMode: 'manual' | 'ai-generated' | 'import';
  step: 'setup' | 'cards' | 'settings' | 'preview' | 'complete';
  
  // AI generation state
  aiGenerationRequest: Partial<FlashcardGenerationRequest> | null;
  isGenerating: boolean;
  generationProgress: number;
  
  // Import state
  importFile: File | null;
  importProgress: number;
  
  // Actions
  startDeckCreation: (mode: 'manual' | 'ai-generated' | 'import') => void;
  updateDeckMetadata: (metadata: Partial<FlashcardDeck>) => void;
  addCard: (card: Flashcard) => void;
  updateCard: (cardId: string, updates: Partial<Flashcard>) => void;
  removeCard: (cardId: string) => void;
  reorderCards: (fromIndex: number, toIndex: number) => void;
  duplicateCard: (cardId: string) => void;
  
  setCreationStep: (step: FlashcardCreationState['step']) => void;
  setAiGenerationRequest: (request: Partial<FlashcardGenerationRequest>) => void;
  setGenerating: (generating: boolean, progress?: number) => void;
  setImportFile: (file: File | null) => void;
  setImportProgress: (progress: number) => void;
  
  saveDeck: () => Promise<FlashcardDeck | null>;
  resetCreation: () => void;
}

// Study session state
export interface FlashcardStudyState {
  // Current session
  currentSession: StudySession | null;
  currentCardIndex: number;
  isCardFlipped: boolean;
  showHint: boolean;
  
  // Study UI state
  isFullscreen: boolean;
  showProgress: boolean;
  autoAdvance: boolean;
  timeRemaining: number | null;
  isPaused: boolean;
  
  // Study responses
  sessionResponses: StudyResponse[];
  currentResponse: Partial<StudyResponse> | null;
  
  // Study settings for current session
  studySettings: {
    mode: StudyMode;
    maxCards?: number;
    timeLimit?: number;
    includeNewCards: boolean;
    includeReviewCards: boolean;
    shuffled: boolean;
  };
  
  // Actions
  startStudySession: (deckId: string, mode: StudyMode, settings?: Partial<FlashcardStudyState['studySettings']>) => void;
  flipCard: () => void;
  toggleHint: () => void;
  answerCard: (answer: string, confidence: ConfidenceLevel, responseTime: number) => void;
  nextCard: () => void;
  previousCard: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => Promise<StudySession>;
  
  // Spaced repetition
  updateSpacedRepetition: (cardId: string, confidence: ConfidenceLevel) => SpacedRepetitionResult;
  
  resetStudySession: () => void;
}

// Deck and card management state
export interface FlashcardManagementState {
  // Deck library
  decks: FlashcardDeck[];
  filteredDecks: FlashcardDeck[];
  
  // Filters and search
  searchQuery: string;
  filter: FlashcardFilter;
  
  // Selected deck and cards
  selectedDeck: FlashcardDeck | null;
  selectedCards: string[];
  
  // UI state
  viewMode: 'grid' | 'list';
  sortBy: 'title' | 'created' | 'lastStudied' | 'cardCount' | 'accuracy';
  sortOrder: 'asc' | 'desc';
  
  // Actions
  loadDecks: () => Promise<void>;
  createDeck: (deck: Omit<FlashcardDeck, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FlashcardDeck>;
  updateDeck: (deckId: string, updates: Partial<FlashcardDeck>) => Promise<void>;
  deleteDeck: (deckId: string) => Promise<void>;
  duplicateDeck: (deckId: string) => Promise<FlashcardDeck>;
  
  setSearchQuery: (query: string) => void;
  setFilter: (filter: Partial<FlashcardFilter>) => void;
  clearFilters: () => void;
  
  selectDeck: (deckId: string) => void;
  toggleCardSelection: (cardId: string) => void;
  clearCardSelection: () => void;
  
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: FlashcardManagementState['sortBy'], order?: 'asc' | 'desc') => void;
  
  applyFilters: () => void;
}

// Progress and analytics state
export interface FlashcardProgressState {
  // Overall progress
  totalDecks: number;
  totalCards: number;
  cardsStudiedToday: number;
  cardsDueToday: number;
  
  // Streaks and achievements
  streak: FlashcardStreak;
  studyInsights: StudyInsight[];
  
  // Performance metrics
  overallAccuracy: number;
  averageStudyTime: number;
  weakAreas: string[];
  strongAreas: string[];
  
  // Actions
  updateProgress: () => void;
  addStudyInsight: (insight: StudyInsight) => void;
  markInsightSeen: (insightId: string) => void;
  dismissInsight: (insightId: string) => void;
  
  calculateDueCards: () => number;
  getRecommendedDecks: () => DeckPreview[];
  getWeakCards: () => CardPreview[];
}

// Combined store type
export interface FlashcardStore extends 
  FlashcardCreationState,
  FlashcardStudyState,
  FlashcardManagementState,
  FlashcardProgressState {}

// Default states
const defaultCreationState: FlashcardCreationState = {
  currentDeck: null,
  currentCards: [],
  creationMode: 'manual',
  step: 'setup',
  aiGenerationRequest: null,
  isGenerating: false,
  generationProgress: 0,
  importFile: null,
  importProgress: 0,
  
  startDeckCreation: () => {},
  updateDeckMetadata: () => {},
  addCard: () => {},
  updateCard: () => {},
  removeCard: () => {},
  reorderCards: () => {},
  duplicateCard: () => {},
  setCreationStep: () => {},
  setAiGenerationRequest: () => {},
  setGenerating: () => {},
  setImportFile: () => {},
  setImportProgress: () => {},
  saveDeck: async () => null,
  resetCreation: () => {}
};

const defaultStudyState: FlashcardStudyState = {
  currentSession: null,
  currentCardIndex: 0,
  isCardFlipped: false,
  showHint: false,
  isFullscreen: false,
  showProgress: true,
  autoAdvance: false,
  timeRemaining: null,
  isPaused: false,
  sessionResponses: [],
  currentResponse: null,
  studySettings: {
    mode: 'classic-flip',
    includeNewCards: true,
    includeReviewCards: true,
    shuffled: false
  },
  
  startStudySession: () => {},
  flipCard: () => {},
  toggleHint: () => {},
  answerCard: () => {},
  nextCard: () => {},
  previousCard: () => {},
  pauseSession: () => {},
  resumeSession: () => {},
  endSession: async () => ({} as StudySession),
  updateSpacedRepetition: () => ({} as SpacedRepetitionResult),
  resetStudySession: () => {}
};

const defaultManagementState: FlashcardManagementState = {
  decks: [], // Will be populated with personalized decks on first load
  filteredDecks: [],
  searchQuery: '',
  filter: {},
  selectedDeck: null,
  selectedCards: [],
  viewMode: 'grid',
  sortBy: 'created',
  sortOrder: 'desc',
  
  loadDecks: async () => {},
  createDeck: async () => ({} as FlashcardDeck),
  updateDeck: async () => {},
  deleteDeck: async () => {},
  duplicateDeck: async () => ({} as FlashcardDeck),
  setSearchQuery: () => {},
  setFilter: () => {},
  clearFilters: () => {},
  selectDeck: () => {},
  toggleCardSelection: () => {},
  clearCardSelection: () => {},
  setViewMode: () => {},
  setSortBy: () => {},
  applyFilters: () => {}
};

const defaultProgressState: FlashcardProgressState = {
  totalDecks: 0,
  totalCards: 0,
  cardsStudiedToday: 0,
  cardsDueToday: 0,
  streak: {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: '',
    streakType: 'daily',
    freezesUsed: 0,
    freezesAvailable: 3
  },
  studyInsights: [],
  overallAccuracy: 0,
  averageStudyTime: 0,
  weakAreas: [],
  strongAreas: [],
  
  updateProgress: () => {},
  addStudyInsight: () => {},
  markInsightSeen: () => {},
  dismissInsight: () => {},
  calculateDueCards: () => 0,
  getRecommendedDecks: () => [],
  getWeakCards: () => []
};

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);

// Calculate course priority for deck creation based on performance metrics
const calculateCoursePriority = (performance: CoursePerformanceMetrics): number => {
  let priority = 0;
  
  // High priority for struggling courses
  if (performance.needsAttention) priority += 100;
  
  // Priority based on grade (lower grades = higher priority)
  if (performance.currentGrade !== null) {
    priority += Math.max(0, (75 - performance.currentGrade)); // 0-75 points
  }
  
  // Priority for upcoming deadlines
  priority += performance.upcomingDeadlinesPressure * 50;
  
  // Priority for low engagement
  if (performance.engagementLevel < 0.5) priority += 30;
  
  // Priority for low assignment completion
  if (performance.assignmentCompletion < 0.7) priority += 25;
  
  // Priority for poor recent performance
  if (performance.recentPerformance < 0.6) priority += 20;
  
  return priority;
};

// Subject-specific flashcard templates for different course types
const SUBJECT_CARD_TEMPLATES = {
  // STEM subjects - focus on formulas, definitions, problem-solving
  mathematics: {
    cards: [
      { front: "What is the quadratic formula?", back: "x = (-b ± √(b²-4ac)) / 2a", tags: ["formula", "algebra"] },
      { front: "Define: Derivative", back: "The rate of change of a function at a specific point", tags: ["calculus", "definition"] },
      { front: "What is the Pythagorean theorem?", back: "a² + b² = c² (for right triangles)", tags: ["geometry", "theorem"] }
    ],
    color: '#3b82f6',
    difficulty: 'medium'
  },
  physics: {
    cards: [
      { front: "Newton's Second Law", back: "F = ma (Force equals mass times acceleration)", tags: ["mechanics", "law"] },
      { front: "Speed of light in vacuum", back: "c = 299,792,458 m/s", tags: ["constants", "electromagnetic"] },
      { front: "What is kinetic energy?", back: "KE = ½mv² (energy of motion)", tags: ["energy", "mechanics"] }
    ],
    color: '#8b5cf6',
    difficulty: 'hard'
  },
  chemistry: {
    cards: [
      { front: "What is Avogadro's number?", back: "6.022 × 10²³ particles/mol", tags: ["constants", "stoichiometry"] },
      { front: "Define: Molarity", back: "Moles of solute per liter of solution (M = mol/L)", tags: ["solutions", "concentration"] },
      { front: "What is the ideal gas law?", back: "PV = nRT", tags: ["gas laws", "thermodynamics"] }
    ],
    color: '#22c55e',
    difficulty: 'medium'
  },
  biology: {
    cards: [
      { front: "What is mitosis?", back: "Cell division that produces two identical diploid cells", tags: ["cell biology", "reproduction"] },
      { front: "Define: Photosynthesis", back: "Process where plants convert light energy into chemical energy (glucose)", tags: ["plant biology", "metabolism"] },
      { front: "What are the four DNA bases?", back: "Adenine (A), Thymine (T), Guanine (G), Cytosine (C)", tags: ["genetics", "molecular biology"] }
    ],
    color: '#16a34a',
    difficulty: 'medium'
  },
  
  // Language subjects - focus on vocabulary, grammar, culture
  spanish: {
    cards: [
      { front: "Hello (formal)", back: "Buenos días / Buenas tardes", tags: ["greetings", "formal"] },
      { front: "How do you say 'I am studying'?", back: "Estoy estudiando", tags: ["present continuous", "verbs"] },
      { front: "What is 'ser' vs 'estar'?", back: "Ser = permanent states, Estar = temporary states/location", tags: ["grammar", "verbs"] }
    ],
    color: '#f59e0b',
    difficulty: 'easy'
  },
  french: {
    cards: [
      { front: "How do you say 'Good morning'?", back: "Bonjour", tags: ["greetings", "basic"] },
      { front: "What is the past tense of 'avoir'?", back: "j'ai eu, tu as eu, il/elle a eu...", tags: ["grammar", "verbs"] },
      { front: "Masculine or feminine: 'la table'?", back: "Feminine (la = feminine article)", tags: ["grammar", "gender"] }
    ],
    color: '#ec4899',
    difficulty: 'easy'
  },
  
  // Computer Science - focus on concepts, algorithms, syntax
  'computer science': {
    cards: [
      { front: "What is Big O notation?", back: "Mathematical notation describing algorithm efficiency/complexity", tags: ["algorithms", "complexity"] },
      { front: "Define: Recursion", back: "A function that calls itself with a base case to stop", tags: ["programming", "concepts"] },
      { front: "What is a hash table?", back: "Data structure using key-value pairs with hash function for O(1) lookup", tags: ["data structures", "algorithms"] }
    ],
    color: '#6366f1',
    difficulty: 'medium'
  },
  
  // History subjects - focus on dates, events, cause-effect
  history: {
    cards: [
      { front: "When did World War II end?", back: "September 2, 1945 (V-J Day)", tags: ["dates", "world war"] },
      { front: "What caused the American Civil War?", back: "Primarily slavery and states' rights disputes", tags: ["causes", "american history"] },
      { front: "Who was the first President of the United States?", back: "George Washington (1789-1797)", tags: ["presidents", "founding"] }
    ],
    color: '#dc2626',
    difficulty: 'easy'
  },
  
  // Business/Economics - focus on terms, concepts, formulas
  economics: {
    cards: [
      { front: "Define: Supply and Demand", back: "Economic model: price determined by availability (supply) vs desire (demand)", tags: ["microeconomics", "market"] },
      { front: "What is GDP?", back: "Gross Domestic Product - total value of goods/services produced in a country", tags: ["macroeconomics", "indicators"] },
      { front: "What is opportunity cost?", back: "The value of the next best alternative when making a choice", tags: ["concepts", "decision making"] }
    ],
    color: '#059669',
    difficulty: 'medium'
  }
};

// Enhanced course performance analysis
interface CoursePerformanceMetrics {
  currentGrade: number | null;
  assignmentCompletion: number; // 0-1
  recentPerformance: number; // 0-1 based on last 5 assignments
  upcomingDeadlinesPressure: number; // 0-1 based on upcoming deadlines
  engagementLevel: number; // 0-1 based on assignment submission patterns
  strugglingAreas: string[];
  needsAttention: boolean;
  semesterProgress: number; // 0-1 how far through semester
}

const analyzeCoursePerformance = (
  course: any,
  courseProgress: any,
  assignments: any[]
): CoursePerformanceMetrics => {
  const now = new Date();
  
  // Get current grade from Canvas enrollment data
  const currentGrade = course.enrollments?.[0]?.computed_current_score || 
                      course.enrollments?.[0]?.grades?.current_score || null;
  
  // Calculate assignment completion rate
  const totalAssignments = courseProgress?.totalAssignments || assignments.length;
  const completedAssignments = courseProgress?.completedAssignments || 0;
  const assignmentCompletion = totalAssignments > 0 ? completedAssignments / totalAssignments : 0;
  
  // Analyze recent performance (last 5 assignments)
  const recentAssignments = assignments
    .filter(a => a.due_at && new Date(a.due_at) < now)
    .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime())
    .slice(0, 5);
  
  // Simulate recent performance based on completion patterns
  const recentPerformance = recentAssignments.length > 0 ? 
    Math.random() * 0.4 + (assignmentCompletion * 0.6) : assignmentCompletion;
  
  // Calculate upcoming deadline pressure
  const upcomingAssignments = assignments.filter(a => {
    if (!a.due_at) return false;
    const dueDate = new Date(a.due_at);
    const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilDue > 0 && daysUntilDue <= 14; // Due within 2 weeks
  });
  
  const upcomingDeadlinesPressure = Math.min(1, upcomingAssignments.length / 5);
  
  // Calculate engagement level based on submission patterns
  const engagementLevel = assignmentCompletion * 0.7 + (recentPerformance * 0.3);
  
  // Identify struggling areas
  const strugglingAreas: string[] = [];
  if (currentGrade && currentGrade < 70) strugglingAreas.push('overall-performance');
  if (assignmentCompletion < 0.6) strugglingAreas.push('assignment-completion');
  if (recentPerformance < 0.6) strugglingAreas.push('recent-performance');
  if (upcomingDeadlinesPressure > 0.7) strugglingAreas.push('deadline-management');
  
  // Determine if course needs attention
  const needsAttention = (currentGrade && currentGrade < 75) || 
                        assignmentCompletion < 0.7 || 
                        recentPerformance < 0.6 ||
                        upcomingDeadlinesPressure > 0.6;
  
  // Estimate semester progress (rough calculation)
  const semesterStart = new Date();
  semesterStart.setMonth(semesterStart.getMonth() - 3); // Assume 4-month semester
  const semesterEnd = new Date();
  semesterEnd.setMonth(semesterEnd.getMonth() + 1);
  const semesterProgress = Math.max(0, Math.min(1, 
    (now.getTime() - semesterStart.getTime()) / (semesterEnd.getTime() - semesterStart.getTime())));
  
  return {
    currentGrade,
    assignmentCompletion,
    recentPerformance,
    upcomingDeadlinesPressure,
    engagementLevel,
    strugglingAreas,
    needsAttention,
    semesterProgress
  };
};

const createPersonalizedDeck = (
  course: any,
  courseProgress: any,
  assignments: any[],
  color: string
): FlashcardDeck => {
  const now = new Date().toISOString();
  const deckId = generateId();
  
  // Enhanced course performance analysis
  const performance = analyzeCoursePerformance(course, courseProgress, assignments);
  
  // Analyze course name to determine subject type
  const courseName = course.name.toLowerCase();
  const courseCode = course.course_code?.toLowerCase() || '';
  
  let subjectType = 'general';
  let template = null;
  
  // Smart subject detection with enhanced patterns
  if (courseName.includes('math') || courseName.includes('calculus') || courseName.includes('algebra') || 
      courseName.includes('statistics') || courseName.includes('geometry') ||
      courseCode.includes('math') || courseCode.includes('calc') || courseCode.includes('stat')) {
    subjectType = 'mathematics';
    template = SUBJECT_CARD_TEMPLATES.mathematics;
  } else if (courseName.includes('physics') || courseCode.includes('phys')) {
    subjectType = 'physics';
    template = SUBJECT_CARD_TEMPLATES.physics;
  } else if (courseName.includes('chemistry') || courseName.includes('chem') || courseCode.includes('chem')) {
    subjectType = 'chemistry';
    template = SUBJECT_CARD_TEMPLATES.chemistry;
  } else if (courseName.includes('biology') || courseName.includes('bio') || courseCode.includes('bio')) {
    subjectType = 'biology';
    template = SUBJECT_CARD_TEMPLATES.biology;
  } else if (courseName.includes('spanish') || courseCode.includes('span')) {
    subjectType = 'spanish';
    template = SUBJECT_CARD_TEMPLATES.spanish;
  } else if (courseName.includes('french') || courseCode.includes('fren')) {
    subjectType = 'french';
    template = SUBJECT_CARD_TEMPLATES.french;
  } else if (courseName.includes('computer') || courseName.includes('programming') || courseName.includes('software') ||
             courseName.includes('data') || courseName.includes('algorithm') ||
             courseCode.includes('cs') || courseCode.includes('csc') || courseCode.includes('comp') ||
             courseCode.includes('cis') || courseCode.includes('it')) {
    subjectType = 'computer science';
    template = SUBJECT_CARD_TEMPLATES['computer science'];
  } else if (courseName.includes('history') || courseCode.includes('hist')) {
    subjectType = 'history';
    template = SUBJECT_CARD_TEMPLATES.history;
  } else if (courseName.includes('economics') || courseName.includes('business') || 
             courseName.includes('finance') || courseName.includes('accounting') ||
             courseCode.includes('econ') || courseCode.includes('bus') || courseCode.includes('fin')) {
    subjectType = 'economics';
    template = SUBJECT_CARD_TEMPLATES.economics;
  }
  
  // Calculate adaptive card count based on performance and needs
  let baseCardCount = 3;
  if (performance.needsAttention) baseCardCount = 5; // More cards for struggling courses
  if (performance.upcomingDeadlinesPressure > 0.7) baseCardCount += 2; // Extra cards for exam prep
  if (performance.engagementLevel < 0.5) baseCardCount += 1; // Extra support for low engagement
  
  // Create cards based on template with performance-based adjustments
  const cards: Flashcard[] = [];
  if (template) {
    // Use template cards and potentially add more based on performance
    const templateCards = template.cards.slice(0, baseCardCount);
    templateCards.forEach((cardTemplate, index) => {
      const cardId = generateId();
      
      // Adjust difficulty based on performance
      let adjustedDifficulty = template.difficulty as DifficultyLevel;
      if (performance.needsAttention && performance.currentGrade && performance.currentGrade < 65) {
        // Make cards easier for very struggling students
        if (adjustedDifficulty === 'hard') adjustedDifficulty = 'medium';
        if (adjustedDifficulty === 'expert') adjustedDifficulty = 'hard';
      }
      
      cards.push({
        id: cardId,
        deckId,
        type: 'basic',
        front: cardTemplate.front,
        back: cardTemplate.back,
        tags: [...cardTemplate.tags, subjectType, ...(performance.strugglingAreas.length > 0 ? ['needs-review'] : [])],
        difficulty: adjustedDifficulty,
        courseId: course.id,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewDate: now,
        studyCount: 0,
        correctCount: 0,
        averageResponseTime: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: 'ai'
      });
    });
  } else {
    // Generic cards for unknown subjects, adjusted for performance
    for (let i = 0; i < baseCardCount; i++) {
      const cardId = generateId();
      cards.push({
        id: cardId,
        deckId,
        type: 'basic',
        front: `Key Concept ${i + 1} from ${course.name}`,
        back: `Important information to remember for ${course.name}`,
        tags: ['general', 'course-specific', ...(performance.strugglingAreas.length > 0 ? ['needs-review'] : [])],
        difficulty: performance.needsAttention ? 'easy' : 'medium' as DifficultyLevel,
        courseId: course.id,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewDate: now,
        studyCount: 0,
        correctCount: 0,
        averageResponseTime: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: 'ai'
      });
    }
  }
  
  // Legacy compatibility
  const currentGrade = performance.currentGrade;
  const isStruggling = performance.needsAttention;
  const hasUpcomingDeadlines = performance.upcomingDeadlinesPressure > 0.5;
  
  // Enhanced deck title and description based on performance analysis
  let deckTitle = course.name;
  let deckDescription = `Essential concepts and key information for ${course.name}`;
  let deckEmoji = '📚';
  
  // Prioritize the most critical issue
  if (performance.needsAttention && performance.currentGrade && performance.currentGrade < 65) {
    deckEmoji = '🆘';
    deckTitle = `${deckEmoji} ${course.name} - Critical Review`;
    deckDescription = `Urgent review cards for ${course.name}. Current grade: ${performance.currentGrade.toFixed(1)}% - Let's turn this around!`;
  } else if (performance.upcomingDeadlinesPressure > 0.7) {
    deckEmoji = '⏰';
    deckTitle = `${deckEmoji} ${course.name} - Exam Prep`;
    deckDescription = `High-priority review for upcoming ${course.name} exams and assignments`;
  } else if (performance.needsAttention) {
    deckEmoji = '📈';
    deckTitle = `${deckEmoji} ${course.name} - Study Boost`;
    if (performance.currentGrade) {
      deckDescription = `Focused review cards for ${course.name}. Current grade: ${performance.currentGrade.toFixed(1)}% - Let's improve it!`;
    } else {
      deckDescription = `Targeted study cards to boost your performance in ${course.name}`;
    }
  } else if (performance.engagementLevel > 0.8 && performance.currentGrade && performance.currentGrade > 85) {
    deckEmoji = '⭐';
    deckTitle = `${deckEmoji} ${course.name} - Mastery Review`;
    deckDescription = `Advanced concepts for ${course.name}. Current grade: ${performance.currentGrade.toFixed(1)}% - Keep up the excellent work!`;
  } else if (hasUpcomingDeadlines) {
    deckEmoji = '📅';
    deckTitle = `${deckEmoji} ${course.name} - Upcoming Review`;
    deckDescription = `Review cards for upcoming ${course.name} assignments and deadlines`;
  }
  
  return {
    id: deckId,
    title: deckTitle,
    description: deckDescription,
    color: template?.color || color,
    cardCount: cards.length,
    cards,
    category: 'class' as const,
    tags: [
      subjectType, 
      'ai-generated',
      `semester-${Math.ceil(performance.semesterProgress * 100)}%`,
      ...(performance.needsAttention ? ['needs-attention'] : []),
      ...(performance.upcomingDeadlinesPressure > 0.5 ? ['exam-prep'] : []),
      ...(performance.engagementLevel < 0.5 ? ['low-engagement'] : []),
      ...(performance.currentGrade && performance.currentGrade > 85 ? ['high-performer'] : []),
      ...performance.strugglingAreas.map(area => `struggling-${area}`)
    ],
    courseId: course.id,
    settings: {
      defaultStudyMode: 'classic-flip',
      enabledStudyModes: ['classic-flip', 'multiple-choice', 'type-answer'],
      showHints: true,
      autoAdvance: false,
      autoAdvanceDelay: 3,
      enableSpacedRepetition: true,
      maxNewCardsPerDay: performance.needsAttention ? 
        (performance.upcomingDeadlinesPressure > 0.7 ? 40 : 30) : 
        (performance.engagementLevel > 0.8 ? 25 : 20),
      maxReviewCardsPerDay: performance.needsAttention ? 
        (performance.upcomingDeadlinesPressure > 0.7 ? 400 : 300) : 
        (performance.engagementLevel > 0.8 ? 250 : 200),
      shuffleCards: true,
      showProgress: true,
      playSounds: false,
      graduatingInterval: 1,
      easyInterval: 4,
      hardInterval: performance.needsAttention ? 1.1 : 1.2 // Shorter intervals for struggling courses
    },
    analytics: {
      totalStudySessions: 0,
      totalTimeSpent: 0,
      averageSessionTime: 0,
      overallAccuracy: 0,
      averageConfidence: 0,
      masteredCards: 0,
      strugglingCards: 0,
      cardsLearned: 0,
      cardsReviewed: 0,
      cardsDue: 0,
      newCardsToday: 0,
      accuracyTrend: 'stable',
      studyStreak: 0,
      longestStreak: 0,
      cardStats: {}
    },
    createdAt: now,
    updatedAt: now,
    createdBy: 'ai'
  };
};

const calculateSpacedRepetition = (
  card: Flashcard, 
  confidence: ConfidenceLevel
): SpacedRepetitionResult => {
  const { interval, repetitions, easeFactor } = card;
  
  let newInterval = interval;
  let newRepetitions = repetitions;
  let newEaseFactor = easeFactor;
  let wasCorrect = confidence >= 3;
  
  if (confidence >= 3) {
    // Correct answer
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
    
    // Adjust ease factor based on confidence
    const easeAdjustment = 0.1 - (5 - confidence) * (0.08 + (5 - confidence) * 0.02);
    newEaseFactor = Math.max(1.3, easeFactor + easeAdjustment);
  } else {
    // Incorrect answer - reset repetitions, short interval
    newRepetitions = 0;
    newInterval = 1;
    newEaseFactor = Math.max(1.3, easeFactor - 0.2);
  }
  
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  
  return {
    newInterval,
    newRepetitions,
    newEaseFactor,
    nextReviewDate: nextReviewDate.toISOString(),
    wasCorrect
  };
};

const applyDeckFilters = (decks: FlashcardDeck[], filter: FlashcardFilter, searchQuery: string): FlashcardDeck[] => {
  let filtered = [...decks];
  
  // Search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(deck => 
      deck.title.toLowerCase().includes(query) ||
      deck.description?.toLowerCase().includes(query) ||
      deck.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }
  
  // Course filter
  if (filter.courseId) {
    filtered = filtered.filter(deck => deck.courseId === filter.courseId);
  }
  
  // Tags filter
  if (filter.tags?.length) {
    filtered = filtered.filter(deck => 
      filter.tags!.some(tag => deck.tags.includes(tag))
    );
  }
  
  // Category filter
  if (filter.dueStatus) {
    const now = new Date().toISOString();
    filtered = filtered.filter(deck => {
      const dueCards = deck.cards.filter(card => card.nextReviewDate <= now).length;
      const newCards = deck.cards.filter(card => card.studyCount === 0).length;
      
      switch (filter.dueStatus) {
        case 'due':
          return dueCards > 0;
        case 'new':
          return newCards > 0;
        case 'learned':
          return deck.cards.every(card => card.studyCount > 0);
        default:
          return true;
      }
    });
  }
  
  return filtered;
};

// Create the store with persistence
export const useFlashcardStore = create<FlashcardStore>()(
  persist(
    (set, get) => ({
      // Spread all default states
      ...defaultCreationState,
      ...defaultStudyState,
      ...defaultManagementState,
      ...defaultProgressState,
      
      // Creation Actions
      startDeckCreation: (mode) => {
        set({
          creationMode: mode,
          step: 'setup',
          currentDeck: {
            title: '',
            description: '',
            color: '#6366f1', // Default indigo color
            category: 'general',
            tags: [],
            settings: {
              defaultStudyMode: 'classic-flip',
              enabledStudyModes: ['classic-flip', 'multiple-choice', 'type-answer'],
              showHints: true,
              autoAdvance: false,
              autoAdvanceDelay: 3,
              enableSpacedRepetition: true,
              maxNewCardsPerDay: 20,
              maxReviewCardsPerDay: 200,
              shuffleCards: false,
              showProgress: true,
              playSounds: false,
              graduatingInterval: 1,
              easyInterval: 4,
              hardInterval: 1.2
            },
            analytics: {
              totalStudySessions: 0,
              totalTimeSpent: 0,
              averageSessionTime: 0,
              overallAccuracy: 0,
              averageConfidence: 0,
              masteredCards: 0,
              strugglingCards: 0,
              cardsLearned: 0,
              cardsReviewed: 0,
              cardsDue: 0,
              newCardsToday: 0,
              accuracyTrend: 'stable',
              studyStreak: 0,
              longestStreak: 0,
              cardStats: {}
            }
          },
          currentCards: []
        });
      },
      
      updateDeckMetadata: (metadata) => {
        set((state) => ({
          currentDeck: state.currentDeck ? { ...state.currentDeck, ...metadata } : null
        }));
      },
      
      addCard: (card) => {
        set((state) => ({
          currentCards: [...state.currentCards, { ...card, id: generateId() }]
        }));
      },
      
      updateCard: (cardId, updates) => {
        set((state) => ({
          currentCards: state.currentCards.map(card =>
            card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
          )
        }));
      },
      
      removeCard: (cardId) => {
        set((state) => ({
          currentCards: state.currentCards.filter(card => card.id !== cardId)
        }));
      },
      
      reorderCards: (fromIndex, toIndex) => {
        set((state) => {
          const cards = [...state.currentCards];
          const [removed] = cards.splice(fromIndex, 1);
          cards.splice(toIndex, 0, removed);
          return { currentCards: cards };
        });
      },
      
      duplicateCard: (cardId) => {
        set((state) => {
          const originalCard = state.currentCards.find(card => card.id === cardId);
          if (!originalCard) return state;
          
          const duplicatedCard = {
            ...originalCard,
            id: generateId(),
            front: `${originalCard.front} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          return {
            currentCards: [...state.currentCards, duplicatedCard]
          };
        });
      },
      
      setCreationStep: (step) => {
        set({ step });
      },
      
      setAiGenerationRequest: (request) => {
        set((state) => ({
          aiGenerationRequest: { ...state.aiGenerationRequest, ...request }
        }));
      },
      
      setGenerating: (generating, progress = 0) => {
        set({ isGenerating: generating, generationProgress: progress });
      },
      
      setImportFile: (file) => {
        set({ importFile: file });
      },
      
      setImportProgress: (progress) => {
        set({ importProgress: progress });
      },
      
      saveDeck: async () => {
        const state = get();
        if (!state.currentDeck || !state.currentCards.length) return null;
        
        const now = new Date().toISOString();
        const newDeck: FlashcardDeck = {
          ...state.currentDeck,
          id: generateId(),
          cardCount: state.currentCards.length,
          cards: state.currentCards,
          createdAt: now,
          updatedAt: now,
          createdBy: state.creationMode === 'ai-generated' ? 'ai' : 'user'
        } as FlashcardDeck;
        
        set((prevState) => ({
          decks: [newDeck, ...prevState.decks],
          totalDecks: prevState.totalDecks + 1,
          totalCards: prevState.totalCards + newDeck.cardCount
        }));
        
        return newDeck;
      },
      
      resetCreation: () => {
        set({
          ...defaultCreationState
        });
      },
      
      // Study Actions
      startStudySession: (deckId, mode, settings = {}) => {
        const state = get();
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;
        
        const now = new Date().toISOString();
        const studySettings = { ...state.studySettings, mode, ...settings };
        
        // Filter cards based on settings
        let sessionCards = [...deck.cards];
        if (!studySettings.includeNewCards) {
          sessionCards = sessionCards.filter(card => card.studyCount > 0);
        }
        if (!studySettings.includeReviewCards) {
          sessionCards = sessionCards.filter(card => card.nextReviewDate > now);
        }
        
        // Limit cards if specified
        if (studySettings.maxCards && sessionCards.length > studySettings.maxCards) {
          sessionCards = sessionCards.slice(0, studySettings.maxCards);
        }
        
        // Shuffle if enabled
        if (studySettings.shuffled) {
          sessionCards = sessionCards.sort(() => Math.random() - 0.5);
        }
        
        const session: StudySession = {
          id: generateId(),
          deckId,
          mode,
          startedAt: now,
          cards: sessionCards,
          currentCardIndex: 0,
          responses: [],
          settings: studySettings,
          isCompleted: false,
          timeSpent: 0
        };
        
        set({
          currentSession: session,
          currentCardIndex: 0,
          isCardFlipped: false,
          showHint: false,
          sessionResponses: [],
          currentResponse: null,
          studySettings
        });
      },
      
      flipCard: () => {
        set((state) => ({ isCardFlipped: !state.isCardFlipped }));
      },
      
      toggleHint: () => {
        set((state) => ({ showHint: !state.showHint }));
      },
      
      answerCard: (answer, confidence, responseTime) => {
        const state = get();
        if (!state.currentSession) return;
        
        const currentCard = state.currentSession.cards[state.currentCardIndex];
        if (!currentCard) return;
        
        const response: StudyResponse = {
          cardId: currentCard.id,
          answer,
          isCorrect: confidence >= 3,
          confidence,
          responseTime,
          mode: state.currentSession.mode,
          timestamp: new Date().toISOString()
        };
        
        // Update spaced repetition
        const srResult = calculateSpacedRepetition(currentCard, confidence);
        
        set((prevState) => ({
          sessionResponses: [...prevState.sessionResponses, response],
          currentResponse: response,
          // Update the card in the deck
          decks: prevState.decks.map(deck => 
            deck.id === state.currentSession!.deckId
              ? {
                  ...deck,
                  cards: deck.cards.map(card =>
                    card.id === currentCard.id
                      ? {
                          ...card,
                          interval: srResult.newInterval,
                          repetitions: srResult.newRepetitions,
                          easeFactor: srResult.newEaseFactor,
                          nextReviewDate: srResult.nextReviewDate,
                          lastReviewedAt: new Date().toISOString(),
                          studyCount: card.studyCount + 1,
                          correctCount: card.correctCount + (srResult.wasCorrect ? 1 : 0),
                          lastConfidence: confidence,
                          averageResponseTime: (card.averageResponseTime * card.studyCount + responseTime) / (card.studyCount + 1),
                          updatedAt: new Date().toISOString()
                        }
                      : card
                  )
                }
              : deck
          )
        }));
      },
      
      nextCard: () => {
        set((state) => {
          if (!state.currentSession) return state;
          
          const nextIndex = state.currentCardIndex + 1;
          if (nextIndex >= state.currentSession.cards.length) {
            return state; // Session complete
          }
          
          return {
            currentCardIndex: nextIndex,
            isCardFlipped: false,
            showHint: false,
            currentResponse: null
          };
        });
      },
      
      previousCard: () => {
        set((state) => ({
          currentCardIndex: Math.max(0, state.currentCardIndex - 1),
          isCardFlipped: false,
          showHint: false,
          currentResponse: null
        }));
      },
      
      pauseSession: () => {
        set({ isPaused: true });
      },
      
      resumeSession: () => {
        set({ isPaused: false });
      },
      
      endSession: async () => {
        const state = get();
        if (!state.currentSession) return {} as StudySession;
        
        const completedSession: StudySession = {
          ...state.currentSession,
          completedAt: new Date().toISOString(),
          isCompleted: true,
          responses: state.sessionResponses,
          timeSpent: Date.now() - new Date(state.currentSession.startedAt).getTime()
        };
        
        // Calculate session summary
        const totalCards = state.sessionResponses.length;
        const correctAnswers = state.sessionResponses.filter(r => r.isCorrect).length;
        const averageResponseTime = totalCards > 0 
          ? state.sessionResponses.reduce((sum, r) => sum + r.responseTime, 0) / totalCards 
          : 0;
        
        completedSession.summary = {
          totalCards,
          correctAnswers,
          averageResponseTime,
          newCardsLearned: state.sessionResponses.filter(r => 
            state.currentSession!.cards.find(c => c.id === r.cardId)?.studyCount === 1
          ).length,
          cardsReviewed: totalCards,
          difficultyBreakdown: {
            easy: state.sessionResponses.filter(r => 
              state.currentSession!.cards.find(c => c.id === r.cardId)?.difficulty === 'easy'
            ).length,
            medium: state.sessionResponses.filter(r => 
              state.currentSession!.cards.find(c => c.id === r.cardId)?.difficulty === 'medium'
            ).length,
            hard: state.sessionResponses.filter(r => 
              state.currentSession!.cards.find(c => c.id === r.cardId)?.difficulty === 'hard'
            ).length,
            expert: state.sessionResponses.filter(r => 
              state.currentSession!.cards.find(c => c.id === r.cardId)?.difficulty === 'expert'
            ).length
          }
        };
        
        completedSession.score = totalCards > 0 ? Math.round((correctAnswers / totalCards) * 100) : 0;
        
        // Update progress
        set((prevState) => ({
          cardsStudiedToday: prevState.cardsStudiedToday + totalCards,
          currentSession: null
        }));
        
        return completedSession;
      },
      
      updateSpacedRepetition: (cardId, confidence) => {
        const state = get();
        const deck = state.decks.find(d => d.cards.some(c => c.id === cardId));
        const card = deck?.cards.find(c => c.id === cardId);
        
        if (!card) return {} as SpacedRepetitionResult;
        
        return calculateSpacedRepetition(card, confidence);
      },
      
      resetStudySession: () => {
        set({
          ...defaultStudyState
        });
      },
      
      // Management Actions
      loadDecks: async () => {
        const state = get();
        
        // Always ensure we have the most current course-aware decks
        try {
          // Import dashboard store to get course data
          const { useDashboardStore } = await import('./dashboard');
          const dashboardState = useDashboardStore.getState();
          
          // Ensure we have fresh course data
          await dashboardState.ensureData();
          const { rawCourses, courses: courseProgress, upcomingAssignments, pastAssignments } = dashboardState;
          
          // Filter for only active, enrolled courses (not past semesters)
          const activeCourses = rawCourses.filter(course => {
            // Only include courses with active enrollment
            const hasActiveEnrollment = course.enrollments?.some(enrollment => 
              enrollment.computed_current_score !== undefined || 
              enrollment.computed_current_grade !== undefined
            );
            return hasActiveEnrollment;
          });
          
          const personalizedDecks: FlashcardDeck[] = [];
          const courseColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1'];
          
          if (activeCourses && activeCourses.length > 0) {
            // Create decks for active courses only, prioritizing those that need attention
            const coursesWithPerformance = activeCourses.map(course => {
              const relatedUpcoming = upcomingAssignments.filter(a => a.course_id === course.id);
              const relatedPast = pastAssignments.filter(a => a.course_id === course.id);
              const allAssignments = [...relatedUpcoming, ...relatedPast];
              const progress = courseProgress.find(cp => cp.id === course.id.toString());
              
              const performance = analyzeCoursePerformance(course, progress, allAssignments);
              
              return {
                course,
                progress,
                assignments: allAssignments,
                performance,
                priorityScore: calculateCoursePriority(performance)
              };
            });
            
            // Sort courses by priority (struggling courses first)
            coursesWithPerformance.sort((a, b) => b.priorityScore - a.priorityScore);
            
            // Create decks for prioritized courses (limit to prevent overwhelming)
            coursesWithPerformance.slice(0, 6).forEach((courseData, index) => {
              const deck = createPersonalizedDeck(
                courseData.course,
                courseData.progress,
                courseData.assignments,
                courseColors[index % courseColors.length]
              );
              personalizedDecks.push(deck);
            });
          }
          
          // Only add fallback decks if no active courses found
          if (personalizedDecks.length === 0) {
            const fallbackDecks = [
              createPersonalizedDeck(
                { id: 999, name: 'Study Skills & Test Taking', course_code: 'STUDY' },
                null,
                [],
                '#6366f1'
              ),
              createPersonalizedDeck(
                { id: 998, name: 'Critical Thinking & Logic', course_code: 'LOGIC' },
                null,
                [],
                '#8b5cf6'
              )
            ];
            personalizedDecks.push(...fallbackDecks);
          }
          
          // Merge with existing user-created decks (preserve custom decks)
          const existingUserDecks = state.decks.filter(deck => deck.createdBy === 'user');
          const allDecks = [...personalizedDecks, ...existingUserDecks];
          
          set({
            decks: allDecks,
            filteredDecks: allDecks,
            totalDecks: allDecks.length,
            totalCards: allDecks.reduce((sum, deck) => sum + deck.cardCount, 0)
          });
          
          // Apply current filters
          get().applyFilters();
          
        } catch (error) {
          console.error('Error loading course-aware decks:', error);
          // Fallback to existing decks if course data fails
          const existingDecks = state.decks.length > 0 ? state.decks : [
            createPersonalizedDeck(
              { id: 1, name: 'General Studies', course_code: 'GEN' },
              null,
              [],
              '#6366f1'
            )
          ];
          
          set({
            decks: existingDecks,
            filteredDecks: existingDecks,
            totalDecks: existingDecks.length,
            totalCards: existingDecks.reduce((sum, deck) => sum + deck.cardCount, 0)
          });
        }
      },
      
      refreshPersonalizedDecks: async () => {
        // Force regeneration of personalized decks based on current course data
        try {
          const { useDashboardStore } = await import('./dashboard');
          const dashboardState = useDashboardStore.getState();
          
          // Ensure we have fresh course data
          await dashboardState.ensureData();
          const { rawCourses, courses: courseProgress, upcomingAssignments, pastAssignments } = dashboardState;
          
          // Filter for active courses only
          const activeCourses = rawCourses.filter(course => {
            const hasActiveEnrollment = course.enrollments?.some(enrollment => 
              enrollment.computed_current_score !== undefined || 
              enrollment.computed_current_grade !== undefined
            );
            return hasActiveEnrollment;
          });
          
          const personalizedDecks: FlashcardDeck[] = [];
          const courseColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1'];
          
          if (activeCourses && activeCourses.length > 0) {
            // Analyze and prioritize courses
            const coursesWithPerformance = activeCourses.map(course => {
              const relatedUpcoming = upcomingAssignments.filter(a => a.course_id === course.id);
              const relatedPast = pastAssignments.filter(a => a.course_id === course.id);
              const allAssignments = [...relatedUpcoming, ...relatedPast];
              const progress = courseProgress.find(cp => cp.id === course.id.toString());
              
              const performance = analyzeCoursePerformance(course, progress, allAssignments);
              
              return {
                course,
                progress,
                assignments: allAssignments,
                performance,
                priorityScore: calculateCoursePriority(performance)
              };
            });
            
            // Sort by priority and create decks
            coursesWithPerformance
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 6)
              .forEach((courseData, index) => {
                const deck = createPersonalizedDeck(
                  courseData.course,
                  courseData.progress,
                  courseData.assignments,
                  courseColors[index % courseColors.length]
                );
                personalizedDecks.push(deck);
              });
          }
          
          // Preserve user-created decks
          const state = get();
          const existingUserDecks = state.decks.filter(deck => deck.createdBy === 'user');
          const allDecks = [...personalizedDecks, ...existingUserDecks];
          
          set({
            decks: allDecks,
            filteredDecks: allDecks,
            totalDecks: allDecks.length,
            totalCards: allDecks.reduce((sum, deck) => sum + deck.cardCount, 0)
          });
          
          // Apply current filters
          get().applyFilters();
          
        } catch (error) {
          console.error('Error refreshing personalized decks:', error);
        }
      },
      
      createDeck: async (deckData) => {
        const now = new Date().toISOString();
        const newDeck: FlashcardDeck = {
          ...deckData,
          id: generateId(),
          createdAt: now,
          updatedAt: now
        };
        
        set((state) => ({
          decks: [newDeck, ...state.decks],
          totalDecks: state.totalDecks + 1,
          totalCards: state.totalCards + newDeck.cardCount
        }));
        
        return newDeck;
      },
      
      updateDeck: async (deckId, updates) => {
        set((state) => ({
          decks: state.decks.map(deck =>
            deck.id === deckId 
              ? { ...deck, ...updates, updatedAt: new Date().toISOString() }
              : deck
          )
        }));
      },
      
      deleteDeck: async (deckId) => {
        set((state) => {
          const deckToDelete = state.decks.find(d => d.id === deckId);
          return {
            decks: state.decks.filter(deck => deck.id !== deckId),
            totalDecks: state.totalDecks - 1,
            totalCards: state.totalCards - (deckToDelete?.cardCount || 0),
            selectedDeck: state.selectedDeck?.id === deckId ? null : state.selectedDeck
          };
        });
      },
      
      duplicateDeck: async (deckId) => {
        const state = get();
        const originalDeck = state.decks.find(d => d.id === deckId);
        if (!originalDeck) return {} as FlashcardDeck;
        
        const now = new Date().toISOString();
        const duplicatedDeck: FlashcardDeck = {
          ...originalDeck,
          id: generateId(),
          title: `${originalDeck.title} (Copy)`,
          cards: originalDeck.cards.map(card => ({
            ...card,
            id: generateId(),
            deckId: generateId(),
            createdAt: now,
            updatedAt: now,
            // Reset study progress
            interval: 0,
            repetitions: 0,
            easeFactor: 2.5,
            nextReviewDate: now,
            studyCount: 0,
            correctCount: 0,
            averageResponseTime: 0
          })),
          createdAt: now,
          updatedAt: now,
          analytics: {
            ...originalDeck.analytics,
            totalStudySessions: 0,
            totalTimeSpent: 0,
            averageSessionTime: 0,
            cardsLearned: 0,
            cardsReviewed: 0,
            cardsDue: 0,
            newCardsToday: 0,
            studyStreak: 0,
            cardStats: {}
          }
        };
        
        set((prevState) => ({
          decks: [duplicatedDeck, ...prevState.decks],
          totalDecks: prevState.totalDecks + 1,
          totalCards: prevState.totalCards + duplicatedDeck.cardCount
        }));
        
        return duplicatedDeck;
      },
      
      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().applyFilters();
      },
      
      setFilter: (filterUpdates) => {
        set((state) => ({
          filter: { ...state.filter, ...filterUpdates }
        }));
        get().applyFilters();
      },
      
      clearFilters: () => {
        set({ filter: {}, searchQuery: '' });
        get().applyFilters();
      },
      
      selectDeck: (deckId) => {
        const state = get();
        const deck = state.decks.find(d => d.id === deckId);
        set({ selectedDeck: deck || null });
      },
      
      toggleCardSelection: (cardId) => {
        set((state) => ({
          selectedCards: state.selectedCards.includes(cardId)
            ? state.selectedCards.filter(id => id !== cardId)
            : [...state.selectedCards, cardId]
        }));
      },
      
      clearCardSelection: () => {
        set({ selectedCards: [] });
      },
      
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },
      
      setSortBy: (sortBy, order) => {
        set({ 
          sortBy, 
          sortOrder: order || (get().sortBy === sortBy && get().sortOrder === 'asc' ? 'desc' : 'asc')
        });
        get().applyFilters();
      },
      
      applyFilters: () => {
        const state = get();
        const filtered = applyDeckFilters(state.decks, state.filter, state.searchQuery);
        
        // Sort filtered results
        filtered.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (state.sortBy) {
            case 'title':
              aValue = a.title.toLowerCase();
              bValue = b.title.toLowerCase();
              break;
            case 'created':
              aValue = new Date(a.createdAt).getTime();
              bValue = new Date(b.createdAt).getTime();
              break;
            case 'lastStudied':
              aValue = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
              bValue = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
              break;
            case 'cardCount':
              aValue = a.cardCount;
              bValue = b.cardCount;
              break;
            case 'accuracy':
              aValue = a.analytics.overallAccuracy;
              bValue = b.analytics.overallAccuracy;
              break;
            default:
              return 0;
          }
          
          if (aValue < bValue) return state.sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return state.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        
        set({ filteredDecks: filtered });
      },
      
      // Progress Actions
      updateProgress: () => {
        const state = get();
        const now = new Date().toISOString();
        const today = now.split('T')[0];
        
        const cardsDue = state.decks.reduce((sum, deck) => 
          sum + deck.cards.filter(card => card.nextReviewDate <= now).length, 0
        );
        
        const cardsStudiedToday = state.decks.reduce((sum, deck) => 
          sum + deck.cards.filter(card => 
            card.lastReviewedAt && card.lastReviewedAt.startsWith(today)
          ).length, 0
        );
        
        set({
          cardsDueToday: cardsDue,
          cardsStudiedToday
        });
      },
      
      addStudyInsight: (insight) => {
        set((state) => ({
          studyInsights: [insight, ...state.studyInsights].slice(0, 10) // Keep only recent insights
        }));
      },
      
      markInsightSeen: (insightId) => {
        set((state) => ({
          studyInsights: state.studyInsights.map(insight =>
            insight.createdAt === insightId 
              ? { ...insight, seenAt: new Date().toISOString() }
              : insight
          )
        }));
      },
      
      dismissInsight: (insightId) => {
        set((state) => ({
          studyInsights: state.studyInsights.map(insight =>
            insight.createdAt === insightId 
              ? { ...insight, dismissedAt: new Date().toISOString() }
              : insight
          )
        }));
      },
      
      calculateDueCards: () => {
        const state = get();
        const now = new Date().toISOString();
        return state.decks.reduce((sum, deck) => 
          sum + deck.cards.filter(card => card.nextReviewDate <= now).length, 0
        );
      },
      
      getRecommendedDecks: () => {
        const state = get();
        const now = new Date().toISOString();
        
        return state.decks
          .map(deck => {
            const dueCards = deck.cards.filter(card => card.nextReviewDate <= now).length;
            const newCards = deck.cards.filter(card => card.studyCount === 0).length;
            const accuracy = deck.analytics.overallAccuracy;
            
            // Enhanced priority calculation based on course performance and learning science
            let priorityScore = 0;
            
            // Critical attention needed (highest priority)
            if (deck.tags.includes('struggling-overall-performance')) {
              priorityScore += 200;
            }
            
            // High priority for courses that need attention
            if (deck.tags.includes('needs-attention')) {
              priorityScore += 150;
            }
            
            // Exam preparation urgency
            if (deck.tags.includes('exam-prep')) {
              priorityScore += 100;
            }
            
            // Low engagement requires intervention
            if (deck.tags.includes('low-engagement')) {
              priorityScore += 80;
            }
            
            // Assignment completion issues
            if (deck.tags.includes('struggling-assignment-completion')) {
              priorityScore += 70;
            }
            
            // Recent performance problems
            if (deck.tags.includes('struggling-recent-performance')) {
              priorityScore += 60;
            }
            
            // Deadline management issues
            if (deck.tags.includes('struggling-deadline-management')) {
              priorityScore += 50;
            }
            
            // Spaced repetition factors
            priorityScore += (dueCards * 3) + (newCards * 2);
            
            // Adjust for semester progress (prioritize mid-semester courses)
            const semesterProgressTag = deck.tags.find(tag => tag.startsWith('semester-'));
            if (semesterProgressTag) {
              const progress = parseInt(semesterProgressTag.split('-')[1]) / 100;
              if (progress >= 0.3 && progress <= 0.7) {
                priorityScore += 25; // Mid-semester boost
              }
            }
            
            // Lower priority for already mastered content
            if (accuracy > 0.9) {
              priorityScore -= 30;
            } else if (accuracy < 0.5 && deck.analytics.totalStudySessions > 3) {
              // Struggling with this deck - increase priority
              priorityScore += 40;
            }
            
            // Time-based factors
            if (deck.createdBy === 'ai') {
              const daysSinceCreated = (new Date().getTime() - new Date(deck.createdAt).getTime()) / (1000 * 60 * 60 * 24);
              if (daysSinceCreated < 3) {
                priorityScore += 40; // Very fresh AI decks
              } else if (daysSinceCreated < 7) {
                priorityScore += 25; // Recent AI decks
              }
            }
            
            // Study streak consideration
            const daysSinceLastStudied = deck.lastStudiedAt ? 
              (new Date().getTime() - new Date(deck.lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24) : 999;
            
            if (daysSinceLastStudied > 7) {
              priorityScore += 30; // Haven't studied in a week
            } else if (daysSinceLastStudied > 3) {
              priorityScore += 15; // Haven't studied in 3 days
            }
            
            // High performer decks get different treatment
            if (deck.tags.includes('high-performer')) {
              priorityScore = Math.max(20, priorityScore * 0.6); // Lower priority but not zero
            }
            
            return {
              id: deck.id,
              title: deck.title,
              description: deck.description,
              color: deck.color,
              icon: deck.icon,
              cardCount: deck.cardCount,
              category: deck.category,
              lastStudiedAt: deck.lastStudiedAt,
              dueCards,
              newCards,
              accuracy,
              priorityScore,
              urgencyLevel: priorityScore > 150 ? 'critical' : priorityScore > 100 ? 'high' : priorityScore > 50 ? 'medium' : 'low',
              nextReviewDate: deck.cards
                .filter(card => card.nextReviewDate > now)
                .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))[0]?.nextReviewDate
            } as DeckPreview & { priorityScore: number; urgencyLevel: string };
          })
          .filter(deck => {
            // Show decks that have content to study OR are high priority
            return deck.dueCards > 0 || deck.newCards > 0 || deck.priorityScore > 40;
          })
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 8); // Increased to show more recommendations
      },
      
      getWeakCards: () => {
        const state = get();
        
        return state.decks
          .flatMap(deck => deck.cards)
          .filter(card => card.studyCount > 0 && card.correctCount / card.studyCount < 0.6)
          .map(card => ({
            id: card.id,
            type: card.type,
            front: card.front,
            difficulty: card.difficulty,
            tags: card.tags,
            isDue: card.nextReviewDate <= new Date().toISOString(),
            isNew: card.studyCount === 0,
            accuracy: card.studyCount > 0 ? card.correctCount / card.studyCount : 0,
            nextReview: card.nextReviewDate
          } as CardPreview))
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 10);
      }
    }),
    {
      name: 'flashcard-store',
      // Only persist certain parts of the state
      partialize: (state) => ({
        decks: state.decks,
        streak: state.streak,
        studyInsights: state.studyInsights,
        totalDecks: state.totalDecks,
        totalCards: state.totalCards,
        overallAccuracy: state.overallAccuracy,
        averageStudyTime: state.averageStudyTime
      })
    }
  )
);

// Convenience hooks for specific parts of the store
export const useFlashcardCreation = () => useFlashcardStore((state) => ({
  currentDeck: state.currentDeck,
  currentCards: state.currentCards,
  creationMode: state.creationMode,
  step: state.step,
  aiGenerationRequest: state.aiGenerationRequest,
  isGenerating: state.isGenerating,
  generationProgress: state.generationProgress,
  importFile: state.importFile,
  importProgress: state.importProgress,
  startDeckCreation: state.startDeckCreation,
  updateDeckMetadata: state.updateDeckMetadata,
  addCard: state.addCard,
  updateCard: state.updateCard,
  removeCard: state.removeCard,
  reorderCards: state.reorderCards,
  duplicateCard: state.duplicateCard,
  setCreationStep: state.setCreationStep,
  setAiGenerationRequest: state.setAiGenerationRequest,
  setGenerating: state.setGenerating,
  setImportFile: state.setImportFile,
  setImportProgress: state.setImportProgress,
  saveDeck: state.saveDeck,
  resetCreation: state.resetCreation
}));

export const useFlashcardStudy = () => useFlashcardStore((state) => ({
  currentSession: state.currentSession,
  currentCardIndex: state.currentCardIndex,
  isCardFlipped: state.isCardFlipped,
  showHint: state.showHint,
  isFullscreen: state.isFullscreen,
  showProgress: state.showProgress,
  autoAdvance: state.autoAdvance,
  timeRemaining: state.timeRemaining,
  isPaused: state.isPaused,
  sessionResponses: state.sessionResponses,
  currentResponse: state.currentResponse,
  studySettings: state.studySettings,
  startStudySession: state.startStudySession,
  flipCard: state.flipCard,
  toggleHint: state.toggleHint,
  answerCard: state.answerCard,
  nextCard: state.nextCard,
  previousCard: state.previousCard,
  pauseSession: state.pauseSession,
  resumeSession: state.resumeSession,
  endSession: state.endSession,
  updateSpacedRepetition: state.updateSpacedRepetition,
  resetStudySession: state.resetStudySession
}));

export const useFlashcardLibrary = () => useFlashcardStore((state) => ({
  decks: state.decks,
  filteredDecks: state.filteredDecks,
  searchQuery: state.searchQuery,
  filter: state.filter,
  selectedDeck: state.selectedDeck,
  selectedCards: state.selectedCards,
  viewMode: state.viewMode,
  sortBy: state.sortBy,
  sortOrder: state.sortOrder,
  loadDecks: state.loadDecks,
  refreshPersonalizedDecks: state.refreshPersonalizedDecks,
  createDeck: state.createDeck,
  updateDeck: state.updateDeck,
  deleteDeck: state.deleteDeck,
  duplicateDeck: state.duplicateDeck,
  setSearchQuery: state.setSearchQuery,
  setFilter: state.setFilter,
  clearFilters: state.clearFilters,
  selectDeck: state.selectDeck,
  toggleCardSelection: state.toggleCardSelection,
  clearCardSelection: state.clearCardSelection,
  setViewMode: state.setViewMode,
  setSortBy: state.setSortBy,
  applyFilters: state.applyFilters
}));

export const useFlashcardProgress = () => useFlashcardStore((state) => ({
  totalDecks: state.totalDecks,
  totalCards: state.totalCards,
  cardsStudiedToday: state.cardsStudiedToday,
  cardsDueToday: state.cardsDueToday,
  streak: state.streak,
  studyInsights: state.studyInsights,
  overallAccuracy: state.overallAccuracy,
  averageStudyTime: state.averageStudyTime,
  weakAreas: state.weakAreas,
  strongAreas: state.strongAreas,
  updateProgress: state.updateProgress,
  addStudyInsight: state.addStudyInsight,
  markInsightSeen: state.markInsightSeen,
  dismissInsight: state.dismissInsight,
  calculateDueCards: state.calculateDueCards,
  getRecommendedDecks: state.getRecommendedDecks,
  getWeakCards: state.getWeakCards
}));
