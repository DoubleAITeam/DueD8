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
