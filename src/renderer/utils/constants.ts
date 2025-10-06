// Centralized constants to reduce duplication across the codebase

// UI Constants
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
} as const;

export const FONT_SIZES = {
  xs: '12px',
  sm: '13px',
  md: '14px',
  lg: '15px',
  xl: '16px',
  xxl: '18px',
  xxxl: '20px'
} as const;

export const BORDER_RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '20px',
  round: '50%',
  pill: '999px'
} as const;

// File Processing Constants
export const SUPPORTED_FILE_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
  MD: 'text/markdown'
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CONTENT_LENGTH = 50000; // characters

// Text Processing Constants
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'have', 'will', 'would', 'could', 'should', 'might', 'about', 'after',
  'before', 'because', 'into', 'through', 'which', 'their', 'there', 'these', 'those',
  'been', 'being', 'were', 'where', 'your', 'yours', 'they', 'them', 'than', 'when',
  'then', 'such', 'while'
]);

export const MIN_WORD_LENGTH = 3;
export const MIN_SENTENCE_LENGTH = 10;

// Analysis Constants
export const ANALYSIS_THRESHOLDS = {
  MIN_WORD_COUNT: 50,
  MIN_PARAGRAPH_COUNT: 2,
  MIN_CITATION_COUNT: 1,
  TRANSITION_SCORE_THRESHOLD: 3,
  SIMILARITY_THRESHOLD: 0.6
} as const;

// Token Estimation Constants
export const TOKENS_PER_WORD = 1.3;
export const TOKENS_PER_CHARACTER = 0.25;

// Date Formatting Constants
export const DATE_FORMATS = {
  SHORT: { month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions,
  MEDIUM: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions,
  LONG: { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  } as Intl.DateTimeFormatOptions
} as const;

// Animation Constants
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300
} as const;

// Breakpoints
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  XXL: 1536
} as const;

// Study Guide Constants
export const STUDY_GUIDE_DEFAULTS = {
  MAX_SECTIONS: 8,
  MIN_SECTION_LENGTH: 100,
  MAX_SECTION_LENGTH: 1000,
  SNIPPET_LENGTH: 220
} as const;

// Assignment Analysis Constants
export const DOCUMENT_CATEGORIES = {
  DRAFT: 'draft',
  RUBRIC: 'rubric',
  INSTRUCTIONS: 'instructions',
  NOTES: 'notes',
  RESEARCH: 'research',
  OTHER: 'other'
} as const;

export const SUGGESTION_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
} as const;

// API Constants
export const API_ENDPOINTS = {
  CANVAS_BASE: 'https://canvas.instructure.com/api/v1',
  ASSIGNMENTS: '/assignments',
  COURSES: '/courses',
  USERS: '/users'
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  CANVAS_TOKEN: 'canvas_token',
  THEME_PREFERENCE: 'theme_preference',
  USER_SETTINGS: 'user_settings',
  LAST_SYNC: 'last_sync'
} as const;