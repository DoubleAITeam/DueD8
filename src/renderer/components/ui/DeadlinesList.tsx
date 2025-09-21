import React from 'react';
import type { Deadline } from '../../state/dashboard';

const intentClass: Record<NonNullable<Deadline['action']>['intent'], string> = {
  submit: 'deadline__action--submit',
  view: 'deadline__action--view',
  study: 'deadline__action--study'
};

type DeadlinesListProps = {
  deadlines: Deadline[];
  selectedDate: Date | null;
  onClear?: () => void;
  onAction?: (deadline: Deadline) => void;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function DeadlinesList({ deadlines, selectedDate, onClear, onAction }: DeadlinesListProps) {
  const activeLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="deadlines">
      <div className="deadlines__header">
        <h3>Upcoming Deadlines</h3>
        {activeLabel ? (
          <button type="button" className="deadlines__clear" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {activeLabel ? <p className="deadlines__filter">Showing items for {activeLabel}</p> : null}
      <ul className="deadlines__list">
        {deadlines.length === 0 ? (
          <li className="deadlines__empty">No deadlines for this date.</li>
        ) : (
          deadlines.map((deadline) => (
            <li key={deadline.id} className="deadlines__item">
              <div className="deadlines__meta">
                <p className="deadlines__title">{deadline.title}</p>
                <p className="deadlines__time">
                  {deadline.course} · {formatTime(deadline.dueAtIso)}
                </p>
              </div>
              {deadline.action ? (
                <button
                  type="button"
                  className={`deadline__action ${intentClass[deadline.action.intent]}`}
                  onClick={() => onAction?.(deadline)}
                >
                  {deadline.action.label}
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
