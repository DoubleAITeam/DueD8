import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import CreateEventPopup from '../components/CreateEventPopup';
import { useTheme } from '../context/ThemeContext';
import {
  useDashboardData,
  useCalendarItems,
  useRawCourses,
  useCourseColors,
  useSetCourseColor,
  useCustomEventActions,
  useCustomEvents,
  useCustomCalendars,
  useCustomCalendarActions,
  type CustomEvent as DashboardCustomEvent
} from '../state/dashboard';
import { coursePalette, getCourseColor } from '../utils/colors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarOption = {
  id: string;
  label: string;
  color?: string;
  kind: 'course' | 'custom' | 'canvas';
  courseId?: number;
  customCalendarId?: string;
};

type EventCalendarOption = {
  id: string;
  label: string;
  color: string;
  kind: 'course' | 'custom';
  courseId?: number;
  customCalendarId?: string;
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
  const { theme } = useTheme();
  const { status } = useDashboardData();
  const rawCourses = useRawCourses();
  const calendarItems = useCalendarItems();
  const customEvents = useCustomEvents();
  const customCalendars = useCustomCalendars();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [mode, setMode] = useState<'month' | 'week' | 'list'>('month');
  const [colorMenu, setColorMenu] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [createPopupPosition, setCreatePopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [deleteConfirmCalendar, setDeleteConfirmCalendar] = useState<CustomCalendar | null>(null);
  const initializedFilters = useRef(false);
  const courseColors = useCourseColors();
  const setCourseColor = useSetCourseColor();
  const { addCustomEvent, deleteCustomEvent } = useCustomEventActions();
  const { addCustomCalendar, updateCustomCalendar, deleteCustomCalendar } = useCustomCalendarActions();

  const customCalendarMap = useMemo(
    () => new Map(customCalendars.map((calendar) => [calendar.id, calendar])),
    [customCalendars]
  );

  const courseLookup = useMemo(() => {
    const map = new Map<number, string>();
    rawCourses.forEach((course) => {
      map.set(course.id, course.course_code || course.name);
    });
    return map;
  }, [rawCourses]);

  const courseIndexLookup = useMemo(() => {
    const map = new Map<number, number>();
    rawCourses.forEach((course, index) => {
      map.set(course.id, index);
    });
    return map;
  }, [rawCourses]);

  const customEventMap = useMemo(
    () => new Map(customEvents.map((event) => [event.id, event])),
    [customEvents]
  );

  function resolveColor(courseId?: number, customCalendarId?: string) {
    if (courseId != null) {
      const courseIndex = courseIndexLookup.get(courseId) ?? 0;
      const fallbackColor = getCourseColor(courseId, courseIndex);
      return courseColors[courseId] ?? fallbackColor;
    }

    if (customCalendarId) {
      return customCalendarMap.get(customCalendarId)?.color ?? '#059669';
    }

    return '#64748b';
  }

  const filterOptions = useMemo<CalendarOption[]>(() => {
    const courseOptions: CalendarOption[] = rawCourses.map((course, index) => ({
      id: `course-${course.id}`,
      label: course.course_code || course.name,
      color: courseColors[course.id] ?? getCourseColor(course.id, index),
      kind: 'course',
      courseId: course.id
    }));

    const customCalendarOptions: CalendarOption[] = customCalendars.map((calendar) => ({
      id: `custom-${calendar.id}`,
      label: calendar.name,
      color: calendar.color,
      kind: 'custom',
      customCalendarId: calendar.id
    }));

    const canvasOptions: CalendarOption[] = [];
    if (calendarItems.some((item) => item.courseId == null && item.source === 'event')) {
      canvasOptions.push({ id: 'canvas-general', label: 'Canvas events', color: '#64748b', kind: 'canvas' });
    }

    return [...courseOptions, ...customCalendarOptions, ...canvasOptions];
  }, [rawCourses, courseColors, customCalendars, calendarItems]);

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
      let filterId: string;
      if (item.courseId != null) {
        filterId = `course-${item.courseId}`;
      } else if (item.source === 'custom' && item.customCalendarId) {
        filterId = `custom-${item.customCalendarId}`;
      } else {
        filterId = 'canvas-general';
      }
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

  const eventCalendarOptions = useMemo<EventCalendarOption[]>(
    () =>
      filterOptions
        .filter((option): option is CalendarOption & { kind: 'course' | 'custom' } =>
          option.kind === 'course' || option.kind === 'custom'
        )
        .map((option) => ({
          id: option.id,
          label: option.label,
          color: option.color ?? '#64748b',
          kind: option.kind,
          courseId: option.courseId,
          customCalendarId: option.customCalendarId
        })),
    [filterOptions]
  );

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

  function renderDeleteButton(event: DashboardCustomEvent) {
    const eventColor = resolveColor(event.courseId, event.customCalendarId);
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

  function handleDeleteCalendar(calendar: CustomCalendar) {
    setDeleteConfirmCalendar(calendar);
  }

  function confirmDeleteCalendar() {
    if (!deleteConfirmCalendar) return;
    
    deleteCustomCalendar(deleteConfirmCalendar.id);
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.delete(`custom-${deleteConfirmCalendar.id}`);
      return Array.from(next);
    });
    setDeleteConfirmCalendar(null);
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
              className="btn btn-primary calendar-header__new-event"
              onClick={() => {
                setSelectedDate(null);
                setCreatePopupPosition({ x: window.innerWidth / 2 - 150, y: 100 });
                setShowCreateModal(true);
              }}
            >
              + New Event
            </button>
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
              <button
                type="button"
                className="calendar-filter calendar-filter--add"
                onClick={() => setShowCalendarModal(true)}
                aria-label="Add calendar"
              >
                <span className="calendar-filter__dot calendar-filter__dot--add" aria-hidden>
                  +
                </span>
                <span>Add calendar</span>
              </button>
              {filterOptions.map((option) => {
                const active = activeFilterSet.has(option.id);
                const isCourseOption = option.kind === 'course' && option.courseId != null;
                const isCustomCalendarOption = option.kind === 'custom' && option.customCalendarId;
                const dotColor = option.color || '#64748b';

                return (
                  <div key={option.id} className="calendar-filter-container">
                    <button
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
                          if (!isCourseOption && !isCustomCalendarOption) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setColorMenu((current) => (current === option.id ? null : option.id));
                        }}
                      />
                      <span>{option.label}</span>
                      {(isCourseOption || isCustomCalendarOption) && colorMenu === option.id ? (
                        <div className="calendar-color-picker" onClick={(event) => event.stopPropagation()}>
                          {coursePalette.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`calendar-color-picker__color${
                                (isCourseOption
                                  ? (courseColors[option.courseId!] ?? '')
                                  : customCalendarMap.get(option.customCalendarId!)?.color ?? '') === color
                                  ? ' calendar-color-picker__color--active'
                                  : ''
                              }`}
                              style={{ background: color }}
                              onClick={() => {
                                if (isCourseOption) {
                                  setCourseColor(option.courseId!, color);
                                } else if (isCustomCalendarOption) {
                                  updateCustomCalendar(option.customCalendarId!, { color });
                                }
                                setColorMenu(null);
                              }}
                              aria-label={`Set ${option.label} calendar color`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </button>
                    {isCustomCalendarOption && option.customCalendarId && !option.customCalendarId.startsWith('default-') && (
                      <button
                        type="button"
                        className="calendar-filter__delete"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const calendar = customCalendarMap.get(option.customCalendarId!);
                          if (calendar) {
                            handleDeleteCalendar(calendar);
                          }
                        }}
                        aria-label={`Delete ${option.label} calendar`}
                        title={`Delete ${option.label} calendar`}
                      >
                        ×
                      </button>
                    )}
                  </div>
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
                  const color = resolveColor(item.courseId, item.customCalendarId);
                  const linkedCustomEvent = item.source === 'custom' ? customEventMap.get(item.id) : undefined;
                  
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
                        {linkedCustomEvent?.location || linkedCustomEvent?.link ? (
                          <p className="calendar-item__details">
                            {linkedCustomEvent.location ? (
                              <span className="calendar-item__details-location">{linkedCustomEvent.location}</span>
                            ) : null}
                            {linkedCustomEvent.link ? (
                              <a
                                className="calendar-item__details-link"
                                href={linkedCustomEvent.link}
                                target="_blank"
                                rel="noreferrer noopener"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Open link
                              </a>
                            ) : null}
                          </p>
                        ) : null}
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
                        const color = resolveColor(item.courseId, item.customCalendarId);
                        const linkedCustomEvent = item.source === 'custom' ? customEventMap.get(item.id) : undefined;
                        const tooltipParts = [item.title];
                        if (linkedCustomEvent?.location) tooltipParts.push(`Location: ${linkedCustomEvent.location}`);
                        if (linkedCustomEvent?.link) tooltipParts.push(linkedCustomEvent.link);
                        const itemTitle = tooltipParts.join(' • ');
                        
                        return (
                          <div key={item.id} className="calendar-item" title={itemTitle}>
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
          onCreateCalendar={(data) => {
            const created = addCustomCalendar(data);
            setActiveFilters((prev) => {
              const next = new Set(prev);
              next.add(`custom-${created.id}`);
              return Array.from(next);
            });
            return created;
          }}
          initialDate={selectedDate || undefined}
          position={createPopupPosition}
          calendarOptions={eventCalendarOptions}
        />

        <CreateCalendarModal
          isOpen={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          onSubmit={(data) => {
            const created = addCustomCalendar(data);
            setShowCalendarModal(false);
            setActiveFilters((prev) => {
              const next = new Set(prev);
              next.add(`custom-${created.id}`);
              return Array.from(next);
            });
          }}
        />

        {deleteConfirmCalendar && (
          <div className="calendar-modal__backdrop" role="dialog" aria-modal="true" onClick={() => setDeleteConfirmCalendar(null)}>
            <div
              className="calendar-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <h3>Delete Calendar</h3>
              <p>
                Are you sure you want to delete the calendar "{deleteConfirmCalendar.name}"? 
                This will also delete all events in this calendar and cannot be undone.
              </p>
              <div className="calendar-modal__actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setDeleteConfirmCalendar(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={confirmDeleteCalendar}
                >
                  Delete Calendar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

type CreateCalendarModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color: string }) => void;
};

function CreateCalendarModal({ isOpen, onClose, onSubmit }: CreateCalendarModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(coursePalette[0]);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setColor(coursePalette[0]);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color });
  };

  return (
    <div className="calendar-modal__backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Create calendar</h3>
        <form onSubmit={handleSubmit}>
          <label className="calendar-modal__label">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Study group"
              autoFocus
              required
            />
          </label>
          <div className="calendar-modal__label">
            <span>Color</span>
            <div className="calendar-modal__palette">
              {coursePalette.map((paletteColor) => (
                <button
                  key={paletteColor}
                  type="button"
                  className={`calendar-color-picker__color${
                    color === paletteColor ? ' calendar-color-picker__color--active' : ''
                  }`}
                  style={{ background: paletteColor }}
                  onClick={() => setColor(paletteColor)}
                  aria-label={`Use ${paletteColor} color`}
                />
              ))}
            </div>
          </div>
          <div className="calendar-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
