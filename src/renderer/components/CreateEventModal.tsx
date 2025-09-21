import React, { useState } from 'react';
import type { CustomEvent } from '../state/dashboard';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CustomEvent, 'id'>) => void;
  initialDate?: string;
}

const categories = [
  { value: 'general', label: 'General', color: '#64748b' },
  { value: 'personal', label: 'Personal', color: '#059669' },
  { value: 'study', label: 'Study', color: '#7c3aed' },
  { value: 'reminder', label: 'Reminder', color: '#dc2626' }
] as const;

export default function CreateEventModal({ isOpen, onClose, onSubmit, initialDate }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(initialDate || new Date().toISOString().slice(0, 16));
  const [category, setCategory] = useState<CustomEvent['category']>('general');

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
    
    setTitle('');
    setStartAt(initialDate || new Date().toISOString().slice(0, 16));
    setCategory('general');
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
            <label>Category</label>
            <div className="category-options">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`category-option ${category === cat.value ? 'active' : ''}`}
                  onClick={() => setCategory(cat.value)}
                >
                  <span className="category-color" style={{ background: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}