import { create } from 'zustand';

const RESERVED_USERNAMES = ['admin', 'support', 'demo', 'team', 'dued8'];
const USERNAME_SUFFIX_LENGTH = 3;

export function isUsernameValidForName(name: string, username: string): boolean {
  if (!name.trim() || !username.trim()) {
    return false;
  }
  const normalisedUsername = normaliseUsername(username);
  const base = usernameBaseFromName(name);
  if (!normalisedUsername.startsWith(base)) {
    return false;
  }
  const suffix = normalisedUsername.slice(base.length);
  if (suffix.length !== USERNAME_SUFFIX_LENGTH) {
    return false;
  }
  if (!/^\d+$/.test(suffix)) {
    return false;
  }
  const uniqueDigits = new Set(suffix.split(''));
  return uniqueDigits.size === suffix.length;
}

type UsernameAvailabilityOptions = {
  ignore?: string;
};

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameBaseFromName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return cleaned || 'student';
}

function uniqueDigitSuffix(length: number): string {
  const digits = new Set<number>();
  while (digits.size < length) {
    const digit = Math.floor(Math.random() * 10);
    digits.add(digit);
  }
  return Array.from(digits).join('');
}

function buildUsernameCandidate(name: string, taken: Set<string>): string {
  const base = usernameBaseFromName(name);
  let candidate = '';
  let attempts = 0;
  while (attempts < 100) {
    const suffix = uniqueDigitSuffix(USERNAME_SUFFIX_LENGTH);
    candidate = `${base}${suffix}`;
    const normalised = normaliseUsername(candidate);
    if (!taken.has(normalised)) {
      taken.add(normalised);
      return candidate;
    }
    attempts += 1;
  }
  const fallbackSuffix = Date.now().toString().slice(-USERNAME_SUFFIX_LENGTH);
  const fallback = `${base}${fallbackSuffix}`;
  taken.add(normaliseUsername(fallback));
  return fallback;
}

function createTakenSet(values: string[]): Set<string> {
  const result = new Set<string>();
  values.forEach((value) => {
    const normalised = normaliseUsername(value);
    if (normalised) {
      result.add(normalised);
    }
  });
  return result;
}

export type NotificationSettings = {
  emailNotifications: boolean;
  weeklySummaries: boolean;
  dueDateReminders: boolean;
};

export type ProfileSettings = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

export type UiSettings = {
  themePreference: 'light' | 'dark' | 'system';
};

export type PrivacySettings = {
  allowDMs: boolean;
  appearInSearch: boolean;
  appearInGroupChats: boolean;
  blockMentions: boolean;
};

export type SettingsSnapshot = {
  notifications: NotificationSettings;
  profile: ProfileSettings;
  ui: UiSettings;
  privacy: PrivacySettings;
};

type SettingsState = SettingsSnapshot & {
  takenUsernames: string[];
  setNotification: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void;
  updateProfile: (updates: Partial<ProfileSettings>) => void;
  setUiThemePreference: (themePreference: UiSettings['themePreference']) => void;
  setPrivacy: <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) => void;
  registerUsername: (username: string) => void;
  isUsernameAvailable: (username: string, options?: UsernameAvailabilityOptions) => boolean;
  suggestUsername: (name: string) => string;
  reset: () => void;
};

const baseSettings: SettingsSnapshot = {
  notifications: {
    emailNotifications: true,
    weeklySummaries: true,
    dueDateReminders: true
  },
  profile: {
    displayName: '',
    username: '',
    avatarUrl: null
  },
  ui: {
    themePreference: 'system'
  },
  privacy: {
    allowDMs: true,
    appearInSearch: true,
    appearInGroupChats: true,
    blockMentions: false
  }
};

function createInitialSettings(): SettingsSnapshot {
  return {
    notifications: { ...baseSettings.notifications },
    profile: { ...baseSettings.profile },
    ui: { ...baseSettings.ui },
    privacy: { ...baseSettings.privacy }
  };
}

function createInitialTakenUsernames(): string[] {
  return [...RESERVED_USERNAMES];
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...createInitialSettings(),
  takenUsernames: createInitialTakenUsernames(),
  setNotification: (key, value) =>
    set((state) => ({
      notifications: {
        ...state.notifications,
        [key]: value
      }
    })),
  updateProfile: (updates) =>
    set((state) => ({
      profile: {
        ...state.profile,
        ...updates
      }
    })),
  setUiThemePreference: (themePreference) => set({ ui: { themePreference } }),
  setPrivacy: (key, value) =>
    set((state) => ({
      privacy: {
        ...state.privacy,
        [key]: value
      }
    })),
  registerUsername: (username) =>
    set((state) => {
      const normalised = normaliseUsername(username);
      if (!normalised) {
        return state;
      }
      const taken = createTakenSet(state.takenUsernames);
      if (taken.has(normalised)) {
        return state;
      }
      return {
        takenUsernames: [...state.takenUsernames, username]
      };
    }),
  isUsernameAvailable: (username, options) => {
    const normalised = normaliseUsername(username);
    if (!normalised) {
      return false;
    }
    const taken = createTakenSet(get().takenUsernames);
    const ignore = options?.ignore ? normaliseUsername(options.ignore) : undefined;
    if (ignore) {
      taken.delete(ignore);
    }
    return !taken.has(normalised);
  },
  suggestUsername: (name) => {
    const taken = createTakenSet(get().takenUsernames);
    return buildUsernameCandidate(name, taken);
  },
  reset: () =>
    set((state) => ({
      ...createInitialSettings(),
      takenUsernames: state.takenUsernames
    }))
}));

export type { SettingsState };
