import React, { useEffect, useState } from 'react';
import type { CustomEvent } from '../state/dashboard';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CustomEvent, 'id'>) => void;
  initialDate?: string;
  calendarOptions?: CalendarOption[];
}

type CalendarOption = {
  id: string;
  label: string;
  color: string;
  kind: 'course' | 'custom';
  courseId?: number;
  customCalendarId?: string;
};

const DEFAULT_OPTIONS: CalendarOption[] = [
  { id: 'default-general', label: 'General', color: '#64748b', kind: 'custom', customCalendarId: 'default-general' },
  { id: 'default-personal', label: 'Personal', color: '#059669', kind: 'custom', customCalendarId: 'default-personal' },
  { id: 'default-study', label: 'Study', color: '#7c3aed', kind: 'custom', customCalendarId: 'default-study' },
  { id: 'default-reminder', label: 'Reminder', color: '#dc2626', kind: 'custom', customCalendarId: 'default-reminder' }
];

export default function CreateEventModal({ isOpen, onClose, onSubmit, initialDate, calendarOptions }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(initialDate || new Date().toISOString().slice(0, 16));
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('default-general');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');

  const options = calendarOptions?.length ? calendarOptions : DEFAULT_OPTIONS;

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setLocation('');
    setLink('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setSelectedCalendarId((current) => {
      if (current && options.some((option) => option.id === current)) {
        return current;
      }
      return options[0]?.id ?? 'default-general';
    });
  }, [isOpen, initialDate, options]);

  if (!isOpen) return null;

  const selectedCalendar = options.find((option) => option.id === selectedCalendarId);

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
    
    setTitle('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setSelectedCalendarId(options[0]?.id ?? 'default-general');
    setLocation('');
    setLink('');
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal-content create-event-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Create Event</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="create-event-form">
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Date & Time *</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Calendar</label>
            <div className="category-grid">
              {options.length ? (
                options.map((option) => (
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
            </div>
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
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={!selectedCalendar}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
