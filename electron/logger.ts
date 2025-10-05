/**
 * Simple logger helpers for Electron main process.
 */
export function mainLog(...args: unknown[]) {
  console.log('[main]', ...args);
}

/**
 * Simple error logger for Electron main process.
 */
export function mainError(...args: unknown[]) {
  console.error('[main]', ...args);
}

export function mainWarn(...args: unknown[]): void {
  console.warn('[main]', ...args);
}

/**
 * Structured analytics logging for the main process.
 */
export function mainAnalytics(event: string, payload: Record<string, unknown> = {}): void {
  mainLog('[analytics]', event, payload);
}
