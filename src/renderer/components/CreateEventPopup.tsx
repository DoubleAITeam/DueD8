import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CustomEvent } from '../state/dashboard';

interface CreateEventPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CustomEvent, 'id'>) => void;
  initialDate?: string;
  position: { x: number; y: number };
}

const categories = [
  { value: 'general', label: 'General', color: '#64748b' },
  { value: 'personal', label: 'Personal', color: '#059669' },
  { value: 'study', label: 'Study', color: '#7c3aed' },
  { value: 'reminder', label: 'Reminder', color: '#dc2626' }
] as const;

export default function CreateEventPopup({ isOpen, onClose, onSubmit, initialDate, position }: CreateEventPopupProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(initialDate || new Date().toISOString().slice(0, 16));
  const [category, setCategory] = useState<CustomEvent['category']>('general');
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSubmit({
      title: title.trim(),
      start_at: startAt,
      category,
      color: categories.find(c => c.value === category)?.color || '#64748b'
    });
    
    // Reset form
    setTitle('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setCategory('general');
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
          <label>Category</label>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={`category-chip ${category === cat.value ? 'active' : ''}`}
                onClick={() => setCategory(cat.value)}
              >
                <span className="category-color" style={{ background: cat.color }} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>,
    document.body
  );
}