import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CustomEvent } from '../state/dashboard';
import { coursePalette } from '../utils/colors';

type CalendarOption = {
  id: string;
  label: string;
  color: string;
  kind: 'course' | 'custom';
  courseId?: number;
  customCalendarId?: string;
};

interface CreateEventPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CustomEvent, 'id'>) => void;
  onCreateCalendar?: (calendar: { name: string; color: string }) => void;
  initialDate?: string;
  position: { x: number; y: number };
  calendarOptions: CalendarOption[];
}

export default function CreateEventPopup({ isOpen, onClose, onSubmit, onCreateCalendar, initialDate, position, calendarOptions }: CreateEventPopupProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(initialDate || new Date().toISOString().slice(0, 16));
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
  const [showCreateCalendar, setShowCreateCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState('#64748b');
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const handleDateTimeClickOutside = (e: MouseEvent) => {
      if (isDateTimePickerOpen && !(e.target as HTMLElement).closest('.datetime-input-container')) {
        setIsDateTimePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleDateTimeClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleDateTimeClickOutside);
    };
  }, [isOpen, onClose, isDateTimePickerOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setTitle('');
    setLocation('');
    setLink('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setShowCreateCalendar(false);
    setNewCalendarName('');
    setNewCalendarColor('#64748b');
    setSelectedCalendarId((current) => {
      if (current && calendarOptions.some((option) => option.id === current)) {
        return current;
      }
      return calendarOptions[0]?.id ?? '';
    });
  }, [isOpen, initialDate, calendarOptions]);

  if (!isOpen) return null;

  const selectedCalendar = calendarOptions.find((option) => option.id === selectedCalendarId);

  const handleCreateCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalendarName.trim() || !onCreateCalendar) return;
    
    const newCalendar = onCreateCalendar({
      name: newCalendarName.trim(),
      color: newCalendarColor
    });
    
    // Select the newly created calendar
    setSelectedCalendarId(newCalendar.id);
    setShowCreateCalendar(false);
    setNewCalendarName('');
    setNewCalendarColor('#64748b');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedCalendar) return;
    
    onSubmit({
      title: title.trim(),
      start_at: startAt,
      courseId: selectedCalendar.courseId,
      customCalendarId: selectedCalendar.customCalendarId,
      location: location.trim() || undefined,
      link: link.trim() || undefined
    });
    
    // Reset form
    setTitle('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setSelectedCalendarId(calendarOptions[0]?.id ?? '');
    setLocation('');
    setLink('');
    onClose();
  };

  // Calculate position with screen bounds
  const adjustedPosition = {
    left: Math.min(position.x + 10, window.innerWidth - 300),
    top: position.y - 20
  };

  return createPortal(
    <div
      ref={popupRef}
      className="create-event-popup"
      style={{
        position: 'absolute',
        left: adjustedPosition.left,
        top: adjustedPosition.top,
        zIndex: 1000
      }}
    >
      <div className="popup-header">
        <h3>Create Event</h3>
        <button type="button" className="popup-close" onClick={onClose}>×</button>
      </div>
      
      <form onSubmit={handleSubmit} className="create-event-form">
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label>Date & Time</label>
          <div className="datetime-input-container">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              onFocus={() => setIsDateTimePickerOpen(true)}
              onBlur={(e) => !e.relatedTarget?.classList.contains('datetime-done-btn') && 
                setTimeout(() => setIsDateTimePickerOpen(false), 100)}
              required
            />
            {isDateTimePickerOpen && (
              <button
                type="button"
                className="datetime-done-btn"
                onClick={() => setIsDateTimePickerOpen(false)}
              >
                Done
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Calendar</label>
          <div className="category-grid">
            {calendarOptions.length ? (
              calendarOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`category-chip ${selectedCalendarId === option.id ? 'active' : ''}`}
                  onClick={() => setSelectedCalendarId(option.id)}
                >
                  <span className="category-color" style={{ background: option.color }} />
                  {option.label}
                </button>
              ))
            ) : (
              <p className="category-empty">Create a calendar to add events.</p>
            )}
            {onCreateCalendar && (
              <button
                type="button"
                className="category-chip category-chip--create"
                onClick={() => setShowCreateCalendar(true)}
              >
                <span className="category-color category-color--add">+</span>
                Create New Calendar
              </button>
            )}
          </div>
          
          {showCreateCalendar && onCreateCalendar && (
            <div className="create-calendar-form">
              <form onSubmit={handleCreateCalendar}>
                <div className="form-group">
                  <label>Calendar Name</label>
                  <input
                    type="text"
                    value={newCalendarName}
                    onChange={(e) => setNewCalendarName(e.target.value)}
                    placeholder="Enter calendar name"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-palette">
                    {coursePalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${newCalendarColor === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => setNewCalendarColor(color)}
                        aria-label={`Select ${color} color`}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateCalendar(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Calendar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Library, Zoom, etc."
          />
        </div>

        <div className="form-group">
          <label>Link (optional)</label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!selectedCalendar}>
            Create
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
