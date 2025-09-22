import React, { useEffect, useRef } from 'react';

interface CalendarContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddEvent: () => void;
}

export default function CalendarContextMenu({ x, y, onClose, onAddEvent }: CalendarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAddEvent = () => {
    onAddEvent();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="calendar-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000
      }}
    >
      <button
        type="button"
        className="calendar-context-menu__item"
        onClick={handleAddEvent}
      >
        <span className="calendar-context-menu__icon">+</span>
        Add Event
      </button>
    </div>
  );
}