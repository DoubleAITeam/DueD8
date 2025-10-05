const TRANSIENT_CODES = new Set(['EBUSY', 'EMFILE', 'ENFILE', 'ETIMEDOUT']);

export interface RetryOptions {
  tries?: number;
  baseMs?: number;
  onRetry?: (error: unknown, attempt: number, remaining: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' && TRANSIENT_CODES.has(code);
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 2);
  const baseMs = Math.max(1, opts.baseMs ?? 150);

  let attempt = 0;
  let lastError: unknown;

  while (attempt < tries) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      lastError = error;

      const remaining = tries - attempt;
      if (!isTransientError(error) || remaining <= 0) {
        throw error;
      }

      opts.onRetry?.(error, attempt, remaining);
      const waitMs = baseMs * attempt;
      await delay(waitMs);
    }
  }

  throw lastError ?? new Error('Retry attempts exhausted.');
}

