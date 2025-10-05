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

/**
 * Structured analytics logging for the renderer process.
 */
export function rendererAnalytics(event: string, payload: Record<string, unknown> = {}): void {
  rendererLog('[analytics]', event, payload);
}
