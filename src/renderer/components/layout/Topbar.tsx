import React, { useEffect, useRef, useState } from 'react';
import { LightningBoltIcon, SearchIcon, BellIcon, SettingsIcon, UserIcon } from '../icons';
import { useAiTokenStore, useUser } from '../../state/dashboard';
import { useNavigate } from '../../routes/router';

type TopbarProps = {
  onToggleSidebar: () => void;
};

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const { name } = useUser();
  const aiTokens = useAiTokenStore();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/study-tools/study-coach?q=${encodeURIComponent(trimmed)}`);
  }

  const initials = name ? name.charAt(0).toUpperCase() : 'A';

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu-button"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
      >
        <span />
      </button>
      <form className="topbar__search" onSubmit={submitSearch} role="search">
        <SearchIcon className="topbar__search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for assignments, classes..."
          aria-label="Search for assignments, classes, or study tools"
          className="topbar__search-input"
        />
      </form>
      <div className="topbar__actions">
        <div className="topbar__tokens" aria-label="AI token balance">
          <LightningBoltIcon className="topbar__token-icon" />
          <span>AI Tokens: {aiTokens.limit.toLocaleString()}</span>
        </div>
        <button type="button" className="icon-button" aria-label="Notifications">
          <BellIcon />
        </button>
        <div className="topbar__avatar" ref={menuRef}>
          <button
            type="button"
            className="topbar__avatar-trigger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="topbar__avatar-circle">{initials}</span>
            <span className="topbar__avatar-name">{name}</span>
          </button>
          {menuOpen ? (
            <div className="topbar__dropdown" role="menu">
              <button
                type="button"
                className="topbar__dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
              >
                <SettingsIcon className="topbar__dropdown-icon" />
                Settings
              </button>
              <button
                type="button"
                className="topbar__dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/logout');
                }}
              >
                <UserIcon className="topbar__dropdown-icon" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
