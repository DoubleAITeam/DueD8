import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Quiz, 
  QuizAttempt, 
  Question, 
  QuizMode, 
  DifficultyLevel,
  QuizStreak,
  QuizXP,
  QuizAchievement,
  LiveChallenge,
  StudyInsight,
  QuizGenerationRequest,
  QuestionType
} from '../../shared/quiz';

// Quiz creation state
export interface QuizCreationState {
  // Current quiz being created/edited
  currentQuiz: Partial<Quiz> | null;
  currentQuestions: Question[];
  
  // Creation flow state
  creationMode: 'manual' | 'ai-generated';
  step: 'setup' | 'questions' | 'settings' | 'preview' | 'complete';
  
  // AI generation state
  aiGenerationRequest: Partial<QuizGenerationRequest> | null;
  isGenerating: boolean;
  generationProgress: number;
  
  // Actions
  startQuizCreation: (mode: 'manual' | 'ai-generated') => void;
  updateQuizMetadata: (metadata: Partial<Quiz>) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (questionId: string, updates: Partial<Question>) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;
  duplicateQuestion: (questionId: string) => void;
  
  setCreationStep: (step: QuizCreationState['step']) => void;
  setAiGenerationRequest: (request: Partial<QuizGenerationRequest>) => void;
  setGenerating: (generating: boolean, progress?: number) => void;
  
  saveQuiz: () => Promise<Quiz | null>;
  resetCreation: () => void;
}

// Quiz taking state
export interface QuizTakingState {
  // Current session
  currentAttempt: QuizAttempt | null;
  currentQuestionIndex: number;
  answers: { [questionId: string]: any };
  confidenceRatings: { [questionId: string]: number };
  
  // UI state
  isFullscreen: boolean;
  showHints: boolean;
  timeRemaining: number | null;
  isPaused: boolean;
  
  // Boss mode specific
  bossLevel: number;
  bossProgress: number;
  
  // Live challenge specific
  liveChallenge: LiveChallenge | null;
  
  // Actions
  startQuiz: (quiz: Quiz, mode: QuizMode) => void;
  answerQuestion: (questionId: string, answer: any, timeSpent: number) => void;
  setConfidenceRating: (questionId: string, rating: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitQuiz: () => Promise<QuizAttempt>;
  pauseQuiz: () => void;
  resumeQuiz: () => void;
  
  // Boss mode actions
  advanceBossLevel: () => void;
  
  // Live challenge actions
  joinLiveChallenge: (challengeId: string) => Promise<boolean>;
  leaveLiveChallenge: () => void;
  
  resetSession: () => void;
}

// Quiz management state
export interface QuizManagementState {
  // Quiz library
  quizzes: Quiz[];
  filteredQuizzes: Quiz[];
  
  // Filters and search
  searchQuery: string;
  filterCourse: number | null;
  filterDifficulty: DifficultyLevel | 'all';
  filterType: QuestionType | 'all';
  sortBy: 'created' | 'title' | 'difficulty' | 'attempts';
  sortOrder: 'asc' | 'desc';
  
  // Selected quiz
  selectedQuiz: Quiz | null;
  quizAttempts: QuizAttempt[];
  
  // Actions
  loadQuizzes: () => Promise<void>;
  createQuiz: (quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Quiz>;
  updateQuiz: (quizId: string, updates: Partial<Quiz>) => Promise<void>;
  deleteQuiz: (quizId: string) => Promise<void>;
  duplicateQuiz: (quizId: string) => Promise<Quiz>;
  
  setSearchQuery: (query: string) => void;
  setFilterCourse: (courseId: number | null) => void;
  setFilterDifficulty: (difficulty: DifficultyLevel | 'all') => void;
  setFilterType: (type: QuestionType | 'all') => void;
  setSortBy: (sortBy: QuizManagementState['sortBy'], order?: 'asc' | 'desc') => void;
  
  selectQuiz: (quizId: string) => void;
  loadQuizAttempts: (quizId: string) => Promise<void>;
  
  applyFilters: () => void;
}

// Gamification state
export interface QuizGamificationState {
  // User progress
  streak: QuizStreak;
  xp: QuizXP;
  achievements: QuizAchievement[];
  unlockedAchievements: string[];
  
  // Insights and recommendations
  studyInsights: StudyInsight[];
  weakAreas: string[];
  strongAreas: string[];
  
  // Actions
  updateStreak: (completed: boolean) => void;
  addXP: (amount: number, source: keyof QuizXP['sources']) => void;
  checkAchievements: (attempt: QuizAttempt) => QuizAchievement[];
  generateInsights: (attempts: QuizAttempt[]) => StudyInsight[];
  
  markInsightSeen: (insightId: string) => void;
  dismissInsight: (insightId: string) => void;
}

// Combined quiz store
export interface QuizStore extends 
  QuizCreationState,
  QuizTakingState, 
  QuizManagementState,
  QuizGamificationState {}

// Default states
const defaultQuizCreationState: QuizCreationState = {
  currentQuiz: null,
  currentQuestions: [],
  creationMode: 'manual',
  step: 'setup',
  aiGenerationRequest: null,
  isGenerating: false,
  generationProgress: 0,
  
  startQuizCreation: () => {},
  updateQuizMetadata: () => {},
  addQuestion: () => {},
  updateQuestion: () => {},
  removeQuestion: () => {},
  reorderQuestions: () => {},
  duplicateQuestion: () => {},
  setCreationStep: () => {},
  setAiGenerationRequest: () => {},
  setGenerating: () => {},
  saveQuiz: async () => null,
  resetCreation: () => {}
};

const defaultQuizTakingState: QuizTakingState = {
  currentAttempt: null,
  currentQuestionIndex: 0,
  answers: {},
  confidenceRatings: {},
  isFullscreen: false,
  showHints: true,
  timeRemaining: null,
  isPaused: false,
  bossLevel: 1,
  bossProgress: 0,
  liveChallenge: null,
  
  startQuiz: () => {},
  answerQuestion: () => {},
  setConfidenceRating: () => {},
  nextQuestion: () => {},
  previousQuestion: () => {},
  submitQuiz: async () => ({} as QuizAttempt),
  pauseQuiz: () => {},
  resumeQuiz: () => {},
  advanceBossLevel: () => {},
  joinLiveChallenge: async () => false,
  leaveLiveChallenge: () => {},
  resetSession: () => {}
};

const defaultQuizManagementState: QuizManagementState = {
  quizzes: [],
  filteredQuizzes: [],
  searchQuery: '',
  filterCourse: null,
  filterDifficulty: 'all',
  filterType: 'all',
  sortBy: 'created',
  sortOrder: 'desc',
  selectedQuiz: null,
  quizAttempts: [],
  
  loadQuizzes: async () => {},
  createQuiz: async () => ({} as Quiz),
  updateQuiz: async () => {},
  deleteQuiz: async () => {},
  duplicateQuiz: async () => ({} as Quiz),
  setSearchQuery: () => {},
  setFilterCourse: () => {},
  setFilterDifficulty: () => {},
  setFilterType: () => {},
  setSortBy: () => {},
  selectQuiz: () => {},
  loadQuizAttempts: async () => {},
  applyFilters: () => {}
};

const defaultGamificationState: QuizGamificationState = {
  streak: {
    currentStreak: 0,
    longestStreak: 0,
    lastQuizDate: '',
    streakType: 'daily'
  },
  xp: {
    totalXP: 0,
    level: 1,
    xpToNextLevel: 100,
    earnedToday: 0,
    sources: {
      quizCompletion: 0,
      perfectScores: 0,
      streakBonuses: 0,
      difficultyBonuses: 0
    }
  },
  achievements: [],
  unlockedAchievements: [],
  studyInsights: [],
  weakAreas: [],
  strongAreas: [],
  
  updateStreak: () => {},
  addXP: () => {},
  checkAchievements: () => [],
  generateInsights: () => [],
  markInsightSeen: () => {},
  dismissInsight: () => {}
};

// Create the store with persistence
export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      // Spread all default states
      ...defaultQuizCreationState,
      ...defaultQuizTakingState,
      ...defaultQuizManagementState,
      ...defaultGamificationState,
      
      // Quiz Creation Actions
      startQuizCreation: (mode) => {
        set({
          creationMode: mode,
          step: 'setup',
          currentQuiz: {
            title: '',
            description: '',
            settings: {
              mode: 'practice',
              showFeedback: 'after-submission',
              allowRetake: true
            },
            analytics: {
              totalAttempts: 0,
              averageScore: 0,
              averageTimeSpent: 0,
              completionRate: 0,
              questionStats: {},
              difficultyDistribution: { easy: 0, medium: 0, hard: 0, expert: 0 }
            }
          },
          currentQuestions: []
        });
      },
      
      updateQuizMetadata: (metadata) => {
        set((state) => ({
          currentQuiz: state.currentQuiz ? { ...state.currentQuiz, ...metadata } : null
        }));
      },
      
      addQuestion: (question) => {
        set((state) => ({
          currentQuestions: [...state.currentQuestions, question]
        }));
      },
      
      updateQuestion: (questionId, updates) => {
        set((state) => ({
          currentQuestions: state.currentQuestions.map(q => 
            q.id === questionId ? { ...q, ...updates } : q
          )
        }));
      },
      
      removeQuestion: (questionId) => {
        set((state) => ({
          currentQuestions: state.currentQuestions.filter(q => q.id !== questionId)
        }));
      },
      
      reorderQuestions: (fromIndex, toIndex) => {
        set((state) => {
          const questions = [...state.currentQuestions];
          const [removed] = questions.splice(fromIndex, 1);
          questions.splice(toIndex, 0, removed);
          return { currentQuestions: questions };
        });
      },
      
      duplicateQuestion: (questionId) => {
        set((state) => {
          const question = state.currentQuestions.find(q => q.id === questionId);
          if (question) {
            const duplicated = {
              ...question,
              id: `${question.id}-copy-${Date.now()}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            return {
              currentQuestions: [...state.currentQuestions, duplicated]
            };
          }
          return state;
        });
      },
      
      setCreationStep: (step) => set({ step }),
      
      setAiGenerationRequest: (request) => {
        set((state) => ({
          aiGenerationRequest: state.aiGenerationRequest 
            ? { ...state.aiGenerationRequest, ...request }
            : request
        }));
      },
      
      setGenerating: (generating, progress = 0) => {
        set({ isGenerating: generating, generationProgress: progress });
      },
      
      saveQuiz: async () => {
        const state = get();
        if (!state.currentQuiz || state.currentQuestions.length === 0) {
          return null;
        }
        
        const quiz: Quiz = {
          ...state.currentQuiz as Quiz,
          id: `quiz-${Date.now()}`,
          questions: state.currentQuestions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Add to quiz library
        set((state) => ({
          quizzes: [quiz, ...state.quizzes]
        }));
        
        return quiz;
      },
      
      resetCreation: () => {
        set({
          ...defaultQuizCreationState,
          // Keep the action functions
          startQuizCreation: get().startQuizCreation,
          updateQuizMetadata: get().updateQuizMetadata,
          addQuestion: get().addQuestion,
          updateQuestion: get().updateQuestion,
          removeQuestion: get().removeQuestion,
          reorderQuestions: get().reorderQuestions,
          duplicateQuestion: get().duplicateQuestion,
          setCreationStep: get().setCreationStep,
          setAiGenerationRequest: get().setAiGenerationRequest,
          setGenerating: get().setGenerating,
          saveQuiz: get().saveQuiz,
          resetCreation: get().resetCreation
        });
      },
      
      // Quiz Taking Actions
      startQuiz: (quiz, mode) => {
        const attempt: QuizAttempt = {
          id: `attempt-${Date.now()}`,
          quizId: quiz.id,
          startedAt: new Date().toISOString(),
          answers: [],
          timeSpent: 0,
          mode,
          isCompleted: false
        };
        
        set({
          currentAttempt: attempt,
          currentQuestionIndex: 0,
          answers: {},
          confidenceRatings: {},
          timeRemaining: quiz.settings.timeLimit ? quiz.settings.timeLimit * 60 : null,
          isPaused: false,
          bossLevel: mode === 'boss-mode' ? 1 : 0,
          bossProgress: 0
        });
      },
      
      answerQuestion: (questionId, answer, timeSpent) => {
        set((state) => ({
          answers: { ...state.answers, [questionId]: answer }
        }));
      },
      
      setConfidenceRating: (questionId, rating) => {
        set((state) => ({
          confidenceRatings: { ...state.confidenceRatings, [questionId]: rating }
        }));
      },
      
      nextQuestion: () => {
        set((state) => ({
          currentQuestionIndex: Math.min(
            state.currentQuestionIndex + 1,
            (state.currentAttempt?.quizId ? 
              state.quizzes.find(q => q.id === state.currentAttempt?.quizId)?.questions.length ?? 1 
              : 1) - 1
          )
        }));
      },
      
      previousQuestion: () => {
        set((state) => ({
          currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1)
        }));
      },
      
      submitQuiz: async () => {
        const state = get();
        if (!state.currentAttempt) {
          throw new Error('No active quiz attempt');
        }
        
        const completedAttempt: QuizAttempt = {
          ...state.currentAttempt,
          completedAt: new Date().toISOString(),
          isCompleted: true,
          confidenceRatings: state.confidenceRatings
        };
        
        // Calculate score and update analytics
        // This would normally involve server-side processing
        
        set({ currentAttempt: null });
        return completedAttempt;
      },
      
      pauseQuiz: () => set({ isPaused: true }),
      resumeQuiz: () => set({ isPaused: false }),
      
      advanceBossLevel: () => {
        set((state) => ({
          bossLevel: state.bossLevel + 1,
          bossProgress: 0
        }));
      },
      
      joinLiveChallenge: async (challengeId) => {
        // Implementation would involve WebSocket connection
        return true;
      },
      
      leaveLiveChallenge: () => {
        set({ liveChallenge: null });
      },
      
      resetSession: () => {
        set({
          ...defaultQuizTakingState,
          // Keep action functions
          startQuiz: get().startQuiz,
          answerQuestion: get().answerQuestion,
          setConfidenceRating: get().setConfidenceRating,
          nextQuestion: get().nextQuestion,
          previousQuestion: get().previousQuestion,
          submitQuiz: get().submitQuiz,
          pauseQuiz: get().pauseQuiz,
          resumeQuiz: get().resumeQuiz,
          advanceBossLevel: get().advanceBossLevel,
          joinLiveChallenge: get().joinLiveChallenge,
          leaveLiveChallenge: get().leaveLiveChallenge,
          resetSession: get().resetSession
        });
      },
      
      // Quiz Management Actions
      loadQuizzes: async () => {
        // Implementation would load from storage/server
        set((state) => ({ filteredQuizzes: state.quizzes }));
      },
      
      createQuiz: async (quizData) => {
        const quiz: Quiz = {
          ...quizData,
          id: `quiz-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        set((state) => ({
          quizzes: [quiz, ...state.quizzes]
        }));
        
        get().applyFilters();
        return quiz;
      },
      
      updateQuiz: async (quizId, updates) => {
        set((state) => ({
          quizzes: state.quizzes.map(quiz => 
            quiz.id === quizId 
              ? { ...quiz, ...updates, updatedAt: new Date().toISOString() }
              : quiz
          )
        }));
        get().applyFilters();
      },
      
      deleteQuiz: async (quizId) => {
        set((state) => ({
          quizzes: state.quizzes.filter(quiz => quiz.id !== quizId),
          selectedQuiz: state.selectedQuiz?.id === quizId ? null : state.selectedQuiz
        }));
        get().applyFilters();
      },
      
      duplicateQuiz: async (quizId) => {
        const state = get();
        const originalQuiz = state.quizzes.find(q => q.id === quizId);
        if (!originalQuiz) throw new Error('Quiz not found');
        
        const duplicatedQuiz: Quiz = {
          ...originalQuiz,
          id: `quiz-${Date.now()}`,
          title: `${originalQuiz.title} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          analytics: {
            ...originalQuiz.analytics,
            totalAttempts: 0,
            averageScore: 0,
            questionStats: {}
          }
        };
        
        set((state) => ({
          quizzes: [duplicatedQuiz, ...state.quizzes]
        }));
        
        get().applyFilters();
        return duplicatedQuiz;
      },
      
      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().applyFilters();
      },
      
      setFilterCourse: (courseId) => {
        set({ filterCourse: courseId });
        get().applyFilters();
      },
      
      setFilterDifficulty: (difficulty) => {
        set({ filterDifficulty: difficulty });
        get().applyFilters();
      },
      
      setFilterType: (type) => {
        set({ filterType: type });
        get().applyFilters();
      },
      
      setSortBy: (sortBy, order = 'desc') => {
        set({ sortBy, sortOrder: order });
        get().applyFilters();
      },
      
      selectQuiz: (quizId) => {
        const state = get();
        const quiz = state.quizzes.find(q => q.id === quizId);
        set({ selectedQuiz: quiz || null });
      },
      
      loadQuizAttempts: async (quizId) => {
        // Implementation would load attempts from storage/server
        set({ quizAttempts: [] });
      },
      
      applyFilters: () => {
        set((state) => {
          let filtered = [...state.quizzes];
          
          // Apply search
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter(quiz => 
              quiz.title.toLowerCase().includes(query) ||
              quiz.description?.toLowerCase().includes(query)
            );
          }
          
          // Apply course filter
          if (state.filterCourse !== null) {
            filtered = filtered.filter(quiz => quiz.courseId === state.filterCourse);
          }
          
          // Apply difficulty filter
          if (state.filterDifficulty !== 'all') {
            filtered = filtered.filter(quiz => {
              const difficulties = quiz.questions.map(q => q.difficulty);
              return difficulties.includes(state.filterDifficulty as DifficultyLevel);
            });
          }
          
          // Apply type filter
          if (state.filterType !== 'all') {
            filtered = filtered.filter(quiz => {
              const types = quiz.questions.map(q => q.type);
              return types.includes(state.filterType as QuestionType);
            });
          }
          
          // Apply sorting
          filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (state.sortBy) {
              case 'title':
                comparison = a.title.localeCompare(b.title);
                break;
              case 'created':
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                break;
              case 'difficulty':
                // Sort by average difficulty
                const aAvg = a.questions.reduce((sum, q) => {
                  const diffMap = { easy: 1, medium: 2, hard: 3, expert: 4 };
                  return sum + diffMap[q.difficulty];
                }, 0) / a.questions.length;
                const bAvg = b.questions.reduce((sum, q) => {
                  const diffMap = { easy: 1, medium: 2, hard: 3, expert: 4 };
                  return sum + diffMap[q.difficulty];
                }, 0) / b.questions.length;
                comparison = aAvg - bAvg;
                break;
              case 'attempts':
                comparison = a.analytics.totalAttempts - b.analytics.totalAttempts;
                break;
            }
            
            return state.sortOrder === 'asc' ? comparison : -comparison;
          });
          
          return { filteredQuizzes: filtered };
        });
      },
      
      // Gamification Actions
      updateStreak: (completed) => {
        set((state) => {
          const today = new Date().toDateString();
          const lastQuizDate = state.streak.lastQuizDate;
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
          
          let newStreak = state.streak.currentStreak;
          
          if (completed) {
            if (lastQuizDate === yesterday) {
              newStreak += 1;
            } else if (lastQuizDate !== today) {
              newStreak = 1;
            }
          } else {
            newStreak = 0;
          }
          
          return {
            streak: {
              ...state.streak,
              currentStreak: newStreak,
              longestStreak: Math.max(state.streak.longestStreak, newStreak),
              lastQuizDate: completed ? today : lastQuizDate
            }
          };
        });
      },
      
      addXP: (amount, source) => {
        set((state) => {
          const newTotal = state.xp.totalXP + amount;
          const newEarnedToday = state.xp.earnedToday + amount;
          
          // Calculate level (100 XP per level)
          const newLevel = Math.floor(newTotal / 100) + 1;
          const xpToNextLevel = (newLevel * 100) - newTotal;
          
          return {
            xp: {
              ...state.xp,
              totalXP: newTotal,
              level: newLevel,
              xpToNextLevel,
              earnedToday: newEarnedToday,
              sources: {
                ...state.xp.sources,
                [source]: state.xp.sources[source] + amount
              }
            }
          };
        });
      },
      
      checkAchievements: (attempt) => {
        // Implementation would check various achievement criteria
        return [];
      },
      
      generateInsights: (attempts) => {
        // Implementation would analyze attempts and generate insights
        return [];
      },
      
      markInsightSeen: (insightId) => {
        set((state) => ({
          studyInsights: state.studyInsights.map(insight => 
            insight.type === insightId ? { ...insight } : insight
          )
        }));
      },
      
      dismissInsight: (insightId) => {
        set((state) => ({
          studyInsights: state.studyInsights.filter(insight => insight.type !== insightId)
        }));
      }
    }),
    {
      name: 'quiz-store',
      partialize: (state) => ({
        // Only persist certain parts of the state
        quizzes: state.quizzes,
        streak: state.streak,
        xp: state.xp,
        achievements: state.achievements,
        unlockedAchievements: state.unlockedAchievements
      })
    }
  )
);

// Selector hooks for better performance
export const useQuizCreation = () => useQuizStore((state) => ({
  currentQuiz: state.currentQuiz,
  currentQuestions: state.currentQuestions,
  creationMode: state.creationMode,
  step: state.step,
  isGenerating: state.isGenerating,
  generationProgress: state.generationProgress,
  
  startQuizCreation: state.startQuizCreation,
  updateQuizMetadata: state.updateQuizMetadata,
  addQuestion: state.addQuestion,
  updateQuestion: state.updateQuestion,
  removeQuestion: state.removeQuestion,
  reorderQuestions: state.reorderQuestions,
  duplicateQuestion: state.duplicateQuestion,
  setCreationStep: state.setCreationStep,
  saveQuiz: state.saveQuiz,
  resetCreation: state.resetCreation
}));

export const useQuizTaking = () => useQuizStore((state) => ({
  currentAttempt: state.currentAttempt,
  currentQuestionIndex: state.currentQuestionIndex,
  answers: state.answers,
  confidenceRatings: state.confidenceRatings,
  timeRemaining: state.timeRemaining,
  isPaused: state.isPaused,
  bossLevel: state.bossLevel,
  
  startQuiz: state.startQuiz,
  answerQuestion: state.answerQuestion,
  setConfidenceRating: state.setConfidenceRating,
  nextQuestion: state.nextQuestion,
  previousQuestion: state.previousQuestion,
  submitQuiz: state.submitQuiz,
  pauseQuiz: state.pauseQuiz,
  resumeQuiz: state.resumeQuiz
}));

export const useQuizLibrary = () => useQuizStore((state) => ({
  quizzes: state.filteredQuizzes,
  searchQuery: state.searchQuery,
  selectedQuiz: state.selectedQuiz,
  
  setSearchQuery: state.setSearchQuery,
  setFilterCourse: state.setFilterCourse,
  setFilterDifficulty: state.setFilterDifficulty,
  setSortBy: state.setSortBy,
  selectQuiz: state.selectQuiz,
  deleteQuiz: state.deleteQuiz,
  duplicateQuiz: state.duplicateQuiz
}));

export const useQuizGamification = () => useQuizStore((state) => ({
  streak: state.streak,
  xp: state.xp,
  achievements: state.achievements,
  studyInsights: state.studyInsights,
  
  updateStreak: state.updateStreak,
  addXP: state.addXP,
  checkAchievements: state.checkAchievements
}));





