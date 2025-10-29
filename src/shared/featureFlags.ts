export const featureFlags = {
  assignmentSourceLinks: true,
  assignmentSolveGuard: true,
  chatFriendliness: true,
  newDashboard: true,
  chatbot_pro_v1: true
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag) {
  return Boolean(featureFlags[flag]);
}
