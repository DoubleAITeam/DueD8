/**
 * PHASE 6: Centralised bridge so future mobile clients can provide their own Canvas implementation.
 */
let activeBridge: typeof window.dued8 | undefined =
  typeof window !== 'undefined' ? window.dued8 : undefined;

export function registerPlatformBridge(bridge: typeof window.dued8) {
  activeBridge = bridge;
}

export function getPlatformBridge() {
  if (!activeBridge) {
    throw new Error('Platform bridge not available');
  }
  return activeBridge;
}
