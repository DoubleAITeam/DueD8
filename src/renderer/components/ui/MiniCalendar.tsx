import React, { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, ArrowLeftIcon, ArrowRightIcon } from './MiniCalendarIcons';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type MiniCalendarProps = {
  month?: Date;
  selected?: Date | null;
  onSelect?: (date: Date) => void;
};

function buildMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days: (Date | null)[] = [];
  const leading = firstDay.getDay();
  for (let i = 0; i < leading; i += 1) {
    days.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(date.getFullYear(), date.getMonth(), day));
  }
  while (days.length % 7 !== 0) {
    days.push(null);
  }
  return days;
}

export default function MiniCalendar({ month, selected, onSelect }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => month ?? new Date());

  useEffect(() => {
    if (month) {
      setViewDate(month);
    }
  }, [month]);

  const cells = useMemo(() => buildMonth(viewDate), [viewDate]);
  const todayKey = new Date().toDateString();
  const selectedKey = selected ? selected.toDateString() : null;

  return (
    <div className="mini-calendar">
      <div className="mini-calendar__header">
        <div className="mini-calendar__title">
          <CalendarIcon />
          <span>
            {viewDate.toLocaleString(undefined, {
              month: 'long',
              year: 'numeric'
            })}
          </span>
        </div>
        <div className="mini-calendar__controls">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
      <div className="mini-calendar__grid">
        {weekdayLabels.map((day) => (
          <span key={day} className="mini-calendar__weekday">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="mini-calendar__cell" />;
          }
          const key = date.toDateString();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              type="button"
              key={key}
              className={`mini-calendar__cell mini-calendar__cell--button ${
                isSelected ? 'mini-calendar__cell--selected' : ''
              } ${isToday ? 'mini-calendar__cell--today' : ''}`.trim()}
              onClick={() => onSelect?.(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
