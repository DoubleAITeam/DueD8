export const featureFlags = {
  assignmentSourceLinks: true,
  assignmentSolveGuard: true,
  chatFriendliness: true,
  newDashboard: true
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag) {
  return Boolean(featureFlags[flag]);
}
