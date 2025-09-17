/**
 * Renderer-side logging helper that prefixes messages to distinguish from main process logs.
 */
export function rendererLog(...args: unknown[]) {
  console.log('[renderer]', ...args);
}

/**
 * Renderer-side error helper.
 */
export function rendererError(...args: unknown[]) {
  console.error('[renderer]', ...args);
}
