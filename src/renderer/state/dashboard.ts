import { create } from 'zustand';

type StudyTool = {
  id: string;
  title: string;
  launchedAtIso: string;
};

export type CourseProgress = {
  id: string;
  name: string;
  completedAssignments: number;
  totalAssignments: number;
  color: 'blue' | 'green' | 'purple';
};

export type Deadline = {
  id: string;
  title: string;
  course: string;
  dueAtIso: string;
  action?: { label: string; intent: 'submit' | 'view' | 'study' };
};

type DashboardState = {
  user: { name: string };
  aiTokens: { used: number; limit: number };
  courses: CourseProgress[];
  deadlines: Deadline[];
  recentlyLaunched: StudyTool[];
  featureFlags: { newDashboard: boolean };
  setFeatureFlag: (flag: keyof DashboardState['featureFlags'], value: boolean) => void;
};

const today = new Date();

function daysFromNow(days: number) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export const useDashboardStore = create<DashboardState>((set) => ({
  user: { name: 'Ahmed' },
  aiTokens: { used: 2200, limit: 7500 },
  courses: [
    {
      id: 'calculus',
      name: 'Calculus II',
      completedAssignments: 8,
      totalAssignments: 12,
      color: 'blue'
    },
    {
      id: 'organic-chemistry',
      name: 'Organic Chemistry',
      completedAssignments: 5,
      totalAssignments: 7,
      color: 'green'
    },
    {
      id: 'philosophy',
      name: 'Intro to Philosophy',
      completedAssignments: 11,
      totalAssignments: 13,
      color: 'purple'
    }
  ],
  deadlines: [
    {
      id: 'dl-1',
      title: 'Calculus II Homework 5',
      course: 'Calculus II',
      dueAtIso: daysFromNow(1),
      action: { label: 'Submit', intent: 'submit' }
    },
    {
      id: 'dl-2',
      title: 'Organic Chemistry Lab Report',
      course: 'Organic Chemistry',
      dueAtIso: daysFromNow(3),
      action: { label: 'View', intent: 'view' }
    },
    {
      id: 'dl-3',
      title: 'Philosophy Reading Quiz',
      course: 'Intro to Philosophy',
      dueAtIso: daysFromNow(7),
      action: { label: 'Study', intent: 'study' }
    }
  ],
  recentlyLaunched: [
    {
      id: 'recent-1',
      title: 'History 101 Midterm Guide',
      launchedAtIso: daysFromNow(-2)
    },
    {
      id: 'recent-2',
      title: 'Biology Flashcards',
      launchedAtIso: daysFromNow(-1)
    },
    {
      id: 'recent-3',
      title: 'Chemistry Practice Quiz',
      launchedAtIso: daysFromNow(-4)
    }
  ],
  featureFlags: { newDashboard: true },
  setFeatureFlag: (flag, value) =>
    set((state) => ({
      featureFlags: {
        ...state.featureFlags,
        [flag]: value
      }
    }))
}));

export function useUser() {
  return useDashboardStore((state) => state.user);
}

export function useAiTokenStore() {
  return useDashboardStore((state) => state.aiTokens);
}

export function useCourses() {
  return useDashboardStore((state) => state.courses);
}

function isWithinNextDays(isoDate: string, days: number) {
  const due = new Date(isoDate);
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + days);
  return due >= now && due <= horizon;
}

export function useDeadlines() {
  return useDashboardStore((state) =>
    state.deadlines.filter((deadline) => isWithinNextDays(deadline.dueAtIso, 14))
  );
}

export function useRecentlyLaunched() {
  return useDashboardStore((state) => state.recentlyLaunched);
}

export function useFeatureFlags() {
  return useDashboardStore((state) => ({
    featureFlags: state.featureFlags,
    setFeatureFlag: state.setFeatureFlag
  }));
}
