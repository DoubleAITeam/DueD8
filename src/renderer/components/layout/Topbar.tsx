import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { LightningBoltIcon, SearchIcon, BellIcon, SettingsIcon, UserIcon, MoonIcon, SunIcon } from '../icons';
import {
  useAiTokenStore,
  useDashboardData,
  usePastAssignments,
  useRawCourses,
  useUpcomingAssignments,
  useUser
} from '../../state/dashboard';
import { useStore } from '../../state/store';
import { useNavigate } from '../../routes/router';
import { useTheme } from '../../context/ThemeContext';

type TopbarProps = {
  onToggleSidebar: () => void;
};

type BaseSearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  searchText: string;
};

type AssignmentSearchItem = BaseSearchItem & {
  type: 'assignment';
  assignmentId: number;
  courseId: number;
  dueAt?: string;
};

type CourseSearchItem = BaseSearchItem & {
  type: 'course';
  courseId: number;
};

type SearchItem = AssignmentSearchItem | CourseSearchItem;

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const { name } = useUser();
  const aiTokens = useAiTokenStore();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchFormRef = useRef<HTMLFormElement | null>(null);
  const listboxId = useId();
  const navigate = useNavigate();
  const setView = useStore((state) => state.setView);

  const { status: dashboardStatus, error: dashboardError } = useDashboardData();
  const rawCourses = useRawCourses();
  const upcomingAssignments = useUpcomingAssignments();
  const pastAssignments = usePastAssignments();

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

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!searchFormRef.current) return;
      if (!searchFormRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const trimmedQuery = query.trim();
  const normalisedQuery = trimmedQuery.toLowerCase();

  const courseNameLookup = useMemo(() => {
    return rawCourses.reduce<Record<number, string>>((acc, course) => {
      acc[course.id] = course.course_code || course.name;
      return acc;
    }, {});
  }, [rawCourses]);

  const assignmentItems = useMemo(() => {
    const map = new Map<number, AssignmentSearchItem>();
    const allAssignments = [...upcomingAssignments, ...pastAssignments];
    allAssignments.forEach((assignment) => {
      if (!assignment || map.has(assignment.id)) return;
      const courseName = courseNameLookup[assignment.course_id];
      const dueLabel = assignment.due_at
        ? new Date(assignment.due_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'No due date provided';
      const subtitle = courseName ? `${courseName} • ${dueLabel}` : dueLabel;
      const searchText = [assignment.name, subtitle, courseName, 'assignment']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      map.set(assignment.id, {
        id: `assignment-${assignment.id}`,
        type: 'assignment',
        title: assignment.name,
        subtitle,
        searchText,
        assignmentId: assignment.id,
        courseId: assignment.course_id,
        dueAt: assignment.due_at ?? undefined
      });
    });
    return Array.from(map.values());
  }, [courseNameLookup, pastAssignments, upcomingAssignments]);

  const courseItems = useMemo(() => {
    return rawCourses.map<CourseSearchItem>((course) => {
      const display = course.course_code || course.name;
      const subtitle = course.course_code && course.course_code !== course.name ? course.name : undefined;
      const searchText = [display, course.name, course.course_code, 'course']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return {
        id: `course-${course.id}`,
        type: 'course',
        title: display,
        subtitle,
        searchText,
        courseId: course.id
      };
    });
  }, [rawCourses]);

  const searchItems = useMemo<SearchItem[]>(() => {
    return [...assignmentItems, ...courseItems];
  }, [assignmentItems, courseItems]);

  const filteredResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return searchItems
      .map((item) => {
        const index = item.searchText.indexOf(normalisedQuery);
        if (index === -1) return null;
        const typeWeight = item.type === 'assignment' ? 0 : 1;
        return { item, score: index, typeWeight };
      })
      .filter((entry): entry is { item: SearchItem; score: number; typeWeight: number } => entry !== null)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.typeWeight !== b.typeWeight) return a.typeWeight - b.typeWeight;
        return a.item.title.localeCompare(b.item.title);
      })
      .slice(0, 10)
      .map((entry) => entry.item);
  }, [normalisedQuery, searchItems]);

  useEffect(() => {
    if (filteredResults.length === 0) {
      setActiveIndex(-1);
    } else {
      setActiveIndex(0);
    }
  }, [filteredResults]);

  function handleSelect(item: SearchItem) {
    setIsSearchOpen(false);
    setQuery('');
    setActiveIndex(-1);
    if (item.type === 'assignment') {
      setView({ screen: 'assignment', courseId: item.courseId, assignmentId: item.assignmentId });
      navigate('/workspace/assignment');
    } else {
      setView({ screen: 'course', courseId: item.courseId });
      navigate('/workspace/course');
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isSearchOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= filteredResults.length ? 0 : next;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredResults.length === 0) return;
      setActiveIndex((prev) => {
        if (prev <= 0) return filteredResults.length - 1;
        return prev - 1;
      });
    } else if (event.key === 'Enter') {
      if (filteredResults.length === 0) return;
      event.preventDefault();
      const index = activeIndex >= 0 ? activeIndex : 0;
      handleSelect(filteredResults[index]);
    } else if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setActiveIndex(-1);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedQuery) {
      setIsSearchOpen(false);
      return;
    }
    if (filteredResults.length === 0) {
      setIsSearchOpen(true);
      return;
    }
    const index = activeIndex >= 0 ? activeIndex : 0;
    handleSelect(filteredResults[index]);
  }

  function handleSearchBlur() {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (!searchFormRef.current) return;
      if (!activeElement || searchFormRef.current.contains(activeElement)) return;
      setIsSearchOpen(false);
      setActiveIndex(-1);
    });
  }

  const initials = name ? name.charAt(0).toUpperCase() : 'A';
  const isLoadingData = dashboardStatus === 'idle' || dashboardStatus === 'loading';
  const noMatches =
    dashboardStatus === 'ready' && normalisedQuery.length > 0 && filteredResults.length === 0;
  const showResultsPanel = isSearchOpen;

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
      <form
        className="topbar__search"
        onSubmit={submitSearch}
        role="search"
        ref={searchFormRef}
        onBlur={handleSearchBlur}
      >
        <SearchIcon className="topbar__search-icon" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsSearchOpen(true);
          }}
          placeholder="Search for assignments, classes..."
          aria-label="Search for assignments, classes, or study tools"
          className="topbar__search-input"
          onFocus={() => setIsSearchOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResultsPanel}
          aria-controls={listboxId}
        />
        {showResultsPanel ? (
          <div className="topbar__search-results" role="presentation">
            {isLoadingData ? (
              <div className="topbar__search-message">Loading your dashboard data…</div>
            ) : dashboardError ? (
              <div className="topbar__search-message" role="alert">
                {dashboardError}
              </div>
            ) : normalisedQuery.length === 0 ? (
              <div className="topbar__search-message">Start typing to search your workspace</div>
            ) : noMatches ? (
              <div className="topbar__search-message">No matches for “{trimmedQuery}”.</div>
            ) : (
              <ul className="topbar__search-list" role="listbox" id={listboxId}>
                {filteredResults.map((item, index) => {
                  const className = [
                    'topbar__search-item',
                    index === activeIndex ? 'topbar__search-item--active' : null
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={className}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelect(item);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div className="topbar__search-item-header">
                        <span className="topbar__search-item-title">{item.title}</span>
                        <span className={`topbar__search-item-type topbar__search-item-type--${item.type}`}>
                          {item.type === 'assignment' ? 'Assignment' : 'Class'}
                        </span>
                      </div>
                      {item.subtitle ? (
                        <div className="topbar__search-item-subtitle">{item.subtitle}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
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
                  toggleTheme();
                }}
              >
                {theme === 'light' ? (
                  <MoonIcon className="topbar__dropdown-icon" />
                ) : (
                  <SunIcon className="topbar__dropdown-icon" />
                )}
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>
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
