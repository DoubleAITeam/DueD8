// Common utility functions to reduce code duplication

/**
 * Generates a unique ID with optional prefix
 */
export function createId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalizes whitespace in text content
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Counts words in text content
 */
export function countWords(content: string): number {
  return normalizeWhitespace(content).split(' ').filter(word => word.length > 0).length;
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Splits content into paragraphs
 */
export function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map(para => para.trim())
    .filter(para => para.length > 0);
}

/**
 * Splits content into sentences
 */
export function splitSentences(content: string): string[] {
  return content
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

/**
 * Formats timestamp for display
 */
export const formatTimestamp = (timestamp: number | string | Date): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(undefined, options);
};

export const formatTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Generic utility for creating lookup tables
export const createLookup = <T, K extends keyof T, V>(
  items: T[], 
  keyField: K, 
  valueField: K | ((item: T) => V)
): Record<string | number, V> => {
  return items.reduce((acc, item) => {
    const key = item[keyField] as string | number;
    const value = typeof valueField === 'function' 
      ? (valueField as (item: T) => V)(item)
      : item[valueField as K] as V;
    acc[key] = value;
    return acc;
  }, {} as Record<string | number, V>);
};



/**
 * Converts text to title case
 */
export function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => 
    word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()
  );
}

/**
 * Escapes HTML special characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Safely parses JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Removes duplicates from array based on key function
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}