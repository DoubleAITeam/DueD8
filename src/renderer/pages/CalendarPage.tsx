import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import CreateEventPopup from '../components/CreateEventPopup';
import {
  useDashboardData,
  useCalendarItems,
  useRawCourses,
  useCourseColors,
  useSetCourseColor,
  useCustomEventActions,
  useCustomEvents,
  type CustomEvent as DashboardCustomEvent
} from '../state/dashboard';
import { coursePalette, getCourseColor } from '../utils/colors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarOption = {
  id: string;
  label: string;
  color?: string;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

export default function CalendarPage() {
  const { status } = useDashboardData();
  const rawCourses = useRawCourses();
  const calendarItems = useCalendarItems();
  const customEvents = useCustomEvents();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [mode, setMode] = useState<'month' | 'week' | 'list'>('month');
  const [colorMenu, setColorMenu] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [createPopupPosition, setCreatePopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const initializedFilters = useRef(false);
  const courseColors = useCourseColors();
  const setCourseColor = useSetCourseColor();
  const { addCustomEvent, deleteCustomEvent } = useCustomEventActions();

  const courseLookup = useMemo(() => {
    const map = new Map<number, string>();
    rawCourses.forEach((course) => {
      map.set(course.id, course.course_code || course.name);
    });
    return map;
  }, [rawCourses]);

  const filterOptions = useMemo<CalendarOption[]>(() => {
    const options: CalendarOption[] = rawCourses.map((course, index) => ({
      id: `course-${course.id}`,
      label: course.course_code || course.name,
      color: courseColors[course.id] ?? getCourseColor(course.id, index)
    }));

    if (calendarItems.some((item) => item.courseId == null && item.source === 'event')) {
      options.push({ id: 'general', label: 'Canvas events', color: '#64748b' });
    }

    if (calendarItems.some((item) => item.source === 'custom')) {
      options.push({ id: 'custom', label: 'My events', color: '#059669' });
    }

    return options;
  }, [rawCourses, calendarItems, courseColors]);

  useEffect(() => {
    if (!colorMenu) return;
    const handleClick = () => setColorMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [colorMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && setContextMenu(null);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    setActiveFilters((prev) => {
      const optionIds = filterOptions.map((option) => option.id);
      if (!initializedFilters.current) {
        initializedFilters.current = true;
        return optionIds;
      }

      const next = prev.filter((id) => optionIds.includes(id));
      optionIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });

      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }

      return next;
    });
  }, [filterOptions]);

  const activeFilterSet = useMemo(() => new Set(activeFilters), [activeFilters]);

  const filteredItems = useMemo(() => {
    if (!activeFilterSet.size) return [];
    return calendarItems.filter((item) => {
      const filterId = item.courseId != null ? `course-${item.courseId}` : 
                      item.source === 'custom' ? 'custom' : 'general';
      return activeFilterSet.has(filterId);
    });
  }, [calendarItems, activeFilterSet]);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const nextMonthStart = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
    [monthStart]
  );

  const monthFilteredItems = useMemo(
    () =>
      filteredItems.filter((item) => {
        const date = new Date(item.start_at);
        return date >= monthStart && date < nextMonthStart;
      }),
    [filteredItems, monthStart, nextMonthStart]
  );

  const weekStartBase = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const weekStart = useMemo(() => {
    if (!monthFilteredItems.length) return weekStartBase;
    const firstDate = new Date(monthFilteredItems[0].start_at);
    return startOfWeek(firstDate);
  }, [monthFilteredItems, weekStartBase]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return end;
  }, [weekStart]);

  const weekFilteredItems = useMemo(
    () =>
      monthFilteredItems.filter((item) => {
        const date = new Date(item.start_at);
        return date >= weekStart && date < weekEnd;
      }),
    [monthFilteredItems, weekStart, weekEnd]
  );

  const itemsSource = useMemo(() => {
    if (mode === 'month') return filteredItems;
    if (mode === 'week') return weekFilteredItems;
    return monthFilteredItems;
  }, [mode, filteredItems, weekFilteredItems, monthFilteredItems]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    itemsSource.forEach((item) => {
      const date = new Date(item.start_at);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const key = toISODate(date);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    map.forEach((items, key) => {
      items.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      map.set(key, items);
    });

    return map;
  }, [itemsSource]);

  const monthGrid = useMemo(() => {
    const startDay = monthStart.getDay();
    const firstVisible = new Date(monthStart);
    firstVisible.setDate(firstVisible.getDate() - startDay);

    const today = new Date();
    const cells: Array<{
      date: Date;
      iso: string;
      inCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(firstVisible);
      date.setDate(firstVisible.getDate() + i);
      cells.push({
        date,
        iso: toISODate(date),
        inCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: isSameDay(date, today)
      });
    }

    return cells;
  }, [monthStart]);

  const weekGrid = useMemo(() => {
    const start = new Date(weekStart);
    const today = new Date();

    const cells: Array<{
      date: Date;
      iso: string;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      cells.push({
        date,
        iso: toISODate(date),
        isToday: isSameDay(date, today)
      });
    }

    return cells;
  }, [weekStart]);

  function handleToggleFilter(id: string) {
    setActiveFilters((prev) => {
      if (prev.includes(id)) {
        return prev.filter((value) => value !== id);
      }
      return [...prev, id];
    });
  }

  function handleMonthChange(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function handleToday() {
    setCurrentMonth(startOfMonth(new Date()));
  }

  function handleCellRightClick(event: React.MouseEvent, date: Date) {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      date: toISODate(date)
    });
  }

  function handleAddEvent() {
    if (!contextMenu) return;
    const dateTime = new Date(contextMenu.date + 'T09:00');
    setSelectedDate(dateTime.toISOString().slice(0, 16));
    // Capture scroll position at the time of popup creation
    setCreatePopupPosition({ 
      x: contextMenu.x, 
      y: contextMenu.y + window.scrollY 
    });
    setShowCreateModal(true);
    setContextMenu(null);
  }

  const categoryColors = {
    'general': '#64748b',
    'personal': '#059669', 
    'study': '#7c3aed',
    'reminder': '#dc2626'
  };

  function renderDeleteButton(event: DashboardCustomEvent) {
    const eventColor = categoryColors[event.category] || '#64748b';
    const eventTime = new Date(event.start_at).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return (
      <button 
        key={event.id}
        onClick={() => handleDeleteEvent(event.id)}
        className="context-menu-delete"
      >
        <span 
          className="event-color-dot" 
          style={{ backgroundColor: eventColor }}
        />
        Delete "{event.title}" ({eventTime})
      </button>
    );
  }

  function getCustomEventsForDate(dateIso: string): DashboardCustomEvent[] {
    return customEvents.filter(event => 
      new Date(event.start_at).toISOString().split('T')[0] === dateIso
    );
  }

  function handleDeleteEvent(eventId: string) {
    deleteCustomEvent(eventId);
    setContextMenu(null);
  }

  function handleCreateEvent(eventData: Parameters<typeof addCustomEvent>[0]) {
    addCustomEvent(eventData);
    setShowCreateModal(false);
    setSelectedDate(null);
  }

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });

  const loading = status === 'loading' && !calendarItems.length;

  return (
    <AppShell pageTitle="Calendar">
      <div className="calendar-page">
        <header className="calendar-header">
          <div className="calendar-header__controls">
            <button type="button" onClick={() => handleMonthChange(-1)} aria-label="Previous month">
              ←
            </button>
            <h2>{monthLabel}</h2>
            <button type="button" onClick={() => handleMonthChange(1)} aria-label="Next month">
              →
            </button>
            <button type="button" className="calendar-header__today" onClick={handleToday}>
              Today
            </button>
          </div>
          <div className="calendar-header__view">
            <button
              type="button"
              className={`calendar-view-toggle${mode === 'list' ? ' calendar-view-toggle--active' : ''}`}
              onClick={() => setMode('list')}
              aria-pressed={mode === 'list'}
            >
              List
            </button>
            <button
              type="button"
              className={`calendar-view-toggle${mode === 'week' ? ' calendar-view-toggle--active' : ''}`}
              onClick={() => setMode('week')}
              aria-pressed={mode === 'week'}
            >
              Week
            </button>
            <button
              type="button"
              className={`calendar-view-toggle${mode === 'month' ? ' calendar-view-toggle--active' : ''}`}
              onClick={() => setMode('month')}
              aria-pressed={mode === 'month'}
            >
              Month
            </button>
          </div>
          {filterOptions.length ? (
            <div className="calendar-filters">
              {filterOptions.map((option) => {
                const active = activeFilterSet.has(option.id);
                const isCourseOption = option.id.startsWith('course-');
                const courseId = isCourseOption ? Number(option.id.slice(7)) : null;
                const dotColor = option.color || '#64748b';

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`calendar-filter ${active ? 'calendar-filter--active' : ''}`}
                    onClick={() => handleToggleFilter(option.id)}
                    aria-pressed={active}
                  >
                    <span
                      className="calendar-filter__dot"
                      style={{ background: dotColor }}
                      aria-hidden
                      onClick={(event) => {
                        if (!courseId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setColorMenu((current) => (current === option.id ? null : option.id));
                      }}
                    />
                    <span>{option.label}</span>
                    {courseId && colorMenu === option.id ? (
                      <div className="calendar-color-picker" onClick={(event) => event.stopPropagation()}>
                        {coursePalette.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`calendar-color-picker__color${
                              (courseColors[courseId] ?? '') === color ? ' calendar-color-picker__color--active' : ''
                            }`}
                            style={{ background: color }}
                            onClick={() => {
                              setCourseColor(courseId, color);
                              setColorMenu(null);
                            }}
                            aria-label={`Set ${option.label} calendar color`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </header>

        {mode === 'list' ? (
          <div className="calendar-list">
            {loading ? (
              <p className="calendar-list__empty">Loading events…</p>
            ) : monthFilteredItems.length === 0 ? (
              <p className="calendar-list__empty">No upcoming events.</p>
            ) : (
              monthFilteredItems
                .slice()
                .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                .map((item) => {
                  const date = new Date(item.start_at);
                  const courseName = item.courseId != null ? courseLookup.get(item.courseId) : item.context_name;
                  const index = item.courseId != null
                    ? rawCourses.findIndex((course) => course.id === item.courseId)
                    : -1;
                  
                  let color: string;
                  if (item.source === 'custom') {
                    // Use custom event color based on category
                    color = item.context_name === 'general' ? '#64748b' :
                            item.context_name === 'personal' ? '#059669' :
                            item.context_name === 'study' ? '#7c3aed' :
                            item.context_name === 'reminder' ? '#dc2626' : '#059669';
                  } else {
                    const fallbackColor = index >= 0 ? getCourseColor(item.courseId!, index) : '#64748b';
                    color = index >= 0 ? courseColors[item.courseId!] ?? fallbackColor : '#64748b';
                  }
                  
                  return (
                    <article key={item.id} className="calendar-list__item">
                      <span className="calendar-item__dot" style={{ background: color }} aria-hidden />
                      <div>
                        <h4>{item.title}</h4>
                        <p>
                          {date.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {courseName ? <span> • {courseName}</span> : null}
                        </p>
                      </div>
                    </article>
                  );
                })
            )}
          </div>
        ) : (
          <div className={`calendar-grid${mode === 'week' ? ' calendar-grid--week' : ''}`}>
            {DAY_LABELS.map((label) => (
              <div key={label} className="calendar-grid__label">
                {label}
              </div>
            ))}
            {(mode === 'week' ? weekGrid : monthGrid).map((day) => {
              const items = itemsByDay.get(day.iso) ?? [];
              return (
                <div
                  key={day.iso}
                  className={`calendar-cell${'inCurrentMonth' in day && !day.inCurrentMonth ? ' calendar-cell--muted' : ''}${day.isToday ? ' calendar-cell--today' : ''}`}
                  onContextMenu={(e) => handleCellRightClick(e, day.date)}
                >
                  <div className="calendar-cell__date">{day.date.getDate()}</div>
                  <div className="calendar-cell__items">
                    {loading ? (
                      <p className="calendar-cell__empty">Loading…</p>
                    ) : items.length === 0 ? (
                      <p className="calendar-cell__empty">—</p>
                    ) : (
                      items.map((item) => {
                        const courseName = item.courseId != null ? courseLookup.get(item.courseId) : item.context_name;
                        const index = item.courseId != null
                          ? rawCourses.findIndex((course) => course.id === item.courseId)
                          : -1;
                        
                        let color: string;
                        if (item.source === 'custom') {
                          // Use custom event color or default to green
                          const customEvent = calendarItems.find(ci => ci.id === item.id);
                          color = customEvent?.context_name === 'general' ? '#64748b' :
                                  customEvent?.context_name === 'personal' ? '#059669' :
                                  customEvent?.context_name === 'study' ? '#7c3aed' :
                                  customEvent?.context_name === 'reminder' ? '#dc2626' : '#059669';
                        } else {
                          const fallbackColor = index >= 0 ? getCourseColor(item.courseId!, index) : '#64748b';
                          color = index >= 0 ? courseColors[item.courseId!] ?? fallbackColor : '#64748b';
                        }
                        
                        return (
                          <div key={item.id} className="calendar-item" title={item.title}>
                            <span className="calendar-item__dot" style={{ background: color }} aria-hidden />
                            <div className="calendar-item__content">
                              <span className="calendar-item__title">{item.title}</span>
                              {courseName ? <span className="calendar-item__meta">{courseName}</span> : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {contextMenu && (
          <div
            className="context-menu"
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
          >
            <button onClick={handleAddEvent}>Create Event</button>
            {getCustomEventsForDate(contextMenu.date).map(renderDeleteButton)}
          </div>
        )}

        <CreateEventPopup
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedDate(null);
          }}
          onSubmit={handleCreateEvent}
          initialDate={selectedDate || undefined}
          position={createPopupPosition}
        />
      </div>
    </AppShell>
  );
}
