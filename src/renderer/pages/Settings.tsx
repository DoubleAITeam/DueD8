import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  useSettingsStore,
  normaliseUsername,
  usernameBaseFromName,
  isUsernameValidForName
} from '../state/settings';
import { UserIcon } from '../components/icons';
import { useStore } from '../state/store';
import type { Profile } from '../state/store';

type SectionId =
  | 'notifications'
  | 'profile'
  | 'customization'
  | 'privacy'
  | 'general';

type CollapsibleSectionProps = {
  id: SectionId;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
};

function CollapsibleSection({ id, title, description, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className="settings-section" data-open={isOpen}>
      <button
        type="button"
        className="settings-section__header"
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        onClick={() => onToggle(id)}
      >
        <div className="settings-section__heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="settings-section__chevron" aria-hidden />
      </button>
      <div
        id={`${id}-content`}
        className={`settings-section__content ${isOpen ? 'settings-section__content--open' : ''}`}
        hidden={!isOpen}
      >
        {children}
      </div>
    </section>
  );
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable';

export default function SettingsPage() {
  const notifications = useSettingsStore((state) => state.notifications);
  const profile = useSettingsStore((state) => state.profile);
  const ui = useSettingsStore((state) => state.ui);
  const privacy = useSettingsStore((state) => state.privacy);
  const setNotification = useSettingsStore((state) => state.setNotification);
  const updateProfile = useSettingsStore((state) => state.updateProfile);
  const setUiThemePreference = useSettingsStore((state) => state.setUiThemePreference);
  const setPrivacy = useSettingsStore((state) => state.setPrivacy);
  const resetSettings = useSettingsStore((state) => state.reset);
  const registerUsername = useSettingsStore((state) => state.registerUsername);
  const suggestUsername = useSettingsStore((state) => state.suggestUsername);
  const isUsernameAvailable = useSettingsStore((state) => state.isUsernameAvailable);

  const canvasProfile = useStore((state) => state.profile);
  const setAppProfile = useStore((state) => state.setProfile);
  const setToast = useStore((state) => state.setToast);
  const canvasName = canvasProfile?.name?.trim() ?? '';

  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>({
    notifications: true,
    profile: true,
    customization: true,
    privacy: true,
    general: true
  });

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameCheckTimeout = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentObjectUrl = useRef<string | null>(null);
  const assignedUsernameRef = useRef<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);

  const previewAvatar = useMemo(() => profile.avatarUrl, [profile.avatarUrl]);

  useEffect(() => {
    return () => {
      if (currentObjectUrl.current) {
        URL.revokeObjectURL(currentObjectUrl.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        window.clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (profile.username && !assignedUsernameRef.current) {
      assignedUsernameRef.current = profile.username;
    }
  }, [profile.username]);

  useEffect(() => {
    if (!canvasName) {
      return;
    }
    if (!displayNameEdited && profile.displayName !== canvasName) {
      updateProfile({ displayName: canvasName });
    }
  }, [canvasName, displayNameEdited, profile.displayName, updateProfile]);

  useEffect(() => {
    const sourceName = canvasName || profile.displayName;
    if (!sourceName || usernameEdited) {
      return;
    }
    const current = normaliseUsername(profile.username);
    const expectedBase = usernameBaseFromName(sourceName);
    if (current && current.startsWith(expectedBase)) {
      return;
    }
    const suggestion = suggestUsername(sourceName);
    updateProfile({ username: suggestion });
    registerUsername(suggestion);
    assignedUsernameRef.current = suggestion;
    setUsernameStatus('available');
  }, [canvasName, profile.displayName, profile.username, registerUsername, suggestUsername, updateProfile, usernameEdited]);

  function toggleSection(id: SectionId) {
    setSectionVisibility((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  function handleUsernameChange(value: string) {
    const cleanedValue = value.replace(/\s+/g, '').toLowerCase();
    updateProfile({ username: cleanedValue });
    if (!usernameEdited) {
      setUsernameEdited(true);
    }
    if (usernameCheckTimeout.current) {
      window.clearTimeout(usernameCheckTimeout.current);
      usernameCheckTimeout.current = null;
    }
    const trimmed = cleanedValue.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const ignore = assignedUsernameRef.current ?? undefined;
    const validationName = canvasName || profile.displayName;
    usernameCheckTimeout.current = window.setTimeout(() => {
      const available = isUsernameAvailable(trimmed, { ignore });
      const validStructure = validationName
        ? isUsernameValidForName(validationName, trimmed)
        : trimmed.length > 0;
      setUsernameStatus(available && validStructure ? 'available' : 'unavailable');
      usernameCheckTimeout.current = null;
    }, 400);
  }

  function handleDisplayNameChange(value: string) {
    if (!displayNameEdited) {
      setDisplayNameEdited(true);
    }
    updateProfile({ displayName: value });
  }

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (PNG or JPG).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
    }
    currentObjectUrl.current = objectUrl;
    updateProfile({ avatarUrl: objectUrl });
    setAvatarError(null);
  }

  function handleAvatarRemove() {
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = null;
    }
    updateProfile({ avatarUrl: null });
  }

  function handleReset() {
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = null;
    }
    if (usernameCheckTimeout.current) {
      window.clearTimeout(usernameCheckTimeout.current);
      usernameCheckTimeout.current = null;
    }
    resetSettings();
    setUsernameStatus('idle');
    setAvatarError(null);
    setDisplayNameEdited(false);
    setUsernameEdited(false);
    assignedUsernameRef.current = null;
  }

  function handleSave() {
    const trimmedUsername = profile.username.trim();
    const ignore = assignedUsernameRef.current ?? undefined;
    const validationName = canvasName || profile.displayName;
    if (!trimmedUsername) {
      setUsernameStatus('unavailable');
      return;
    }
    const available = isUsernameAvailable(trimmedUsername, { ignore });
    const validStructure = validationName
      ? isUsernameValidForName(validationName, trimmedUsername)
      : trimmedUsername.length > 0;
    if (!available || !validStructure) {
      setUsernameStatus('unavailable');
      return;
    }
    registerUsername(trimmedUsername);
    assignedUsernameRef.current = trimmedUsername;
    setUsernameStatus('available');
    // Mock persistence until backend wiring is ready.
    // eslint-disable-next-line no-console
    console.log('Saving settings', {
      notifications,
      profile,
      ui,
      privacy
    });

    const trimmedDisplayName = profile.displayName.trim();
    const nextProfile: Profile = {
      ...(canvasProfile ?? {})
    };

    if (trimmedDisplayName) {
      nextProfile.name = trimmedDisplayName;
    }

    nextProfile.avatarUrl = profile.avatarUrl ?? null;

    setAppProfile(nextProfile);
    setToast('Settings saved');
  }

  return (
    <AppShell pageTitle="Settings">
      <div className="settings-page">
        <p className="settings-intro">
          Personalise how DueD8 keeps you in the loop, how you appear to classmates, and decide who can reach you.
        </p>

        <div className="settings-stack">
          <CollapsibleSection
            id="notifications"
            title="Notification Settings"
            description="Choose which reminders land in your inbox."
            isOpen={sectionVisibility.notifications}
            onToggle={toggleSection}
          >
            <div className="settings-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notifications.emailNotifications}
                  onChange={(event) => setNotification('emailNotifications', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Email notifications</span>
                  <p>Stay updated when grades post or instructors send announcements.</p>
                </div>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notifications.weeklySummaries}
                  onChange={(event) => setNotification('weeklySummaries', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Weekly summaries</span>
                  <p>A snapshot of your progress and upcoming work delivered every Monday.</p>
                </div>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notifications.dueDateReminders}
                  onChange={(event) => setNotification('dueDateReminders', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Due date reminders</span>
                  <p>We will nudge you the day before assignments are due.</p>
                </div>
              </label>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="profile"
            title="Profile Customisation"
            description="Update how your classmates and teammates see you."
            isOpen={sectionVisibility.profile}
            onToggle={toggleSection}
          >
            <div className="settings-profile">
              <div className="settings-avatar">
                {previewAvatar ? (
                  <img src={previewAvatar} alt="Profile" />
                ) : (
                  <div className="settings-avatar__placeholder" aria-hidden>
                    <UserIcon size={32} />
                  </div>
                )}
                <div className="settings-avatar__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload new photo
                  </button>
                  {previewAvatar ? (
                    <button type="button" className="btn btn-secondary" onClick={handleAvatarRemove}>
                      Remove
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleAvatarUpload}
                    className="settings-avatar__input"
                  />
                  {avatarError ? <p className="settings-field-error">{avatarError}</p> : null}
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  type="text"
                  value={profile.displayName}
                  onChange={(event) => handleDisplayNameChange(event.target.value)}
                  placeholder="How should DueD8 address you?"
                  className="form-input"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="username">
                  Username <span>(unique)</span>
                </label>
                <input
                  id="username"
                  type="text"
                  value={profile.username}
                  onChange={(event) => handleUsernameChange(event.target.value)}
                  placeholder="e.g. ahmedmohamed123"
                  aria-describedby="username-status"
                  className="form-input"
                />
                <p id="username-status" className={`settings-field-hint settings-field-hint--${usernameStatus}`}>
                  {usernameStatus === 'idle' ? 'Pick something memorable.' : null}
                  {usernameStatus === 'checking' ? 'Checking availability...' : null}
                  {usernameStatus === 'available' ? 'Nice! This username is available.' : null}
                  {usernameStatus === 'unavailable'
                    ? 'Already taken or does not meet the rules. Try again to get a fresh suffix.'
                    : null}
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="customization"
            title="UI Preferences"
            description="Preview upcoming theme controls for your workspace."
            isOpen={sectionVisibility.customization}
            onToggle={toggleSection}
          >
            <div className="settings-field">
              <label htmlFor="themePreference">Color theme</label>
              <select
                id="themePreference"
                value={ui.themePreference}
                onChange={(event) => setUiThemePreference(event.target.value as typeof ui.themePreference)}
                className="form-input"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Match system</option>
              </select>
              <p className="settings-field-hint">
                Theme syncing is coming soon -- for now we will prioritise your toggle in the main menu.
              </p>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="privacy"
            title="Privacy & Social"
            description="Decide who can reach out and where your profile appears."
            isOpen={sectionVisibility.privacy}
            onToggle={toggleSection}
          >
            <div className="settings-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={privacy.allowDMs}
                  onChange={(event) => setPrivacy('allowDMs', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Allow direct messages</span>
                  <p>Let classmates and tutors message you privately.</p>
                </div>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={privacy.appearInSearch}
                  onChange={(event) => setPrivacy('appearInSearch', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Appear in search</span>
                  <p>Show up when peers look for study partners.</p>
                </div>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={privacy.appearInGroupChats}
                  onChange={(event) => setPrivacy('appearInGroupChats', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Appear in group chats</span>
                  <p>Allow others to add you to collaborative study rooms.</p>
                </div>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={privacy.blockMentions}
                  onChange={(event) => setPrivacy('blockMentions', event.target.checked)}
                />
                <span className="settings-toggle__control" aria-hidden />
                <div className="settings-toggle__details">
                  <span>Block mentions</span>
                  <p>Mute @mentions from classmates outside your courses.</p>
                </div>
              </label>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="general"
            title="General"
            description="Quick actions for managing your preferences."
            isOpen={sectionVisibility.general}
            onToggle={toggleSection}
          >
            <div className="settings-actions">
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                Reset to defaults
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save changes
              </button>
            </div>
            <p className="settings-field-hint">
              Saving will sync with the cloud in a future release. Today it helps us confirm the UI flow.
            </p>
          </CollapsibleSection>
        </div>

        <footer className="settings-footer">
          <p>
            Need help understanding how we use your data? Check out the{' '}
            <a href="https://dued8.com/privacy" target="_blank" rel="noreferrer">
              privacy policy
            </a>{' '}
            or visit our <a href="https://dued8.com/help" target="_blank" rel="noreferrer">help centre</a> for tips.
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
