import React from 'react';
import type { Assignment } from '../../lib/canvasClient';

type Props = {
  assignments: Assignment[];
  courseLookup?: Record<number, string>;
  loading?: boolean;
  onSelect?: (assignment: Assignment) => void;
  emptyMessage?: string;
};

export default function AssignmentsList({
  assignments,
  courseLookup = {},
  loading,
  onSelect,
  emptyMessage = 'No upcoming assignments.'
}: Props) {
  if (loading) return <p>Loading assignments...</p>;
  if (!assignments?.length) return <p>{emptyMessage}</p>;
  const sorted = [...assignments].sort((a, b) => {
    const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    return da - db;
  });
  return (
    <ul className="assignments-list">
      {sorted.map((assignment) => (
        <li
          key={assignment.id}
          className={`assignment-item${onSelect ? ' assignment-item--clickable' : ''}`}
          onClick={onSelect ? () => onSelect(assignment) : undefined}
        >
          <div className="assignment-item__title">{assignment.name}</div>
          {assignment.due_at ? (
            <div className="assignment-item__due">
              Due {new Date(assignment.due_at).toLocaleString()}
            </div>
          ) : (
            <div className="assignment-item__due">
              {/* PHASE 1: Provide clarity when Canvas omits due dates. */}
              No due date provided – check Canvas for details.
            </div>
          )}
          <div className="assignment-item__course">
            {courseLookup[assignment.course_id] ? `Course: ${courseLookup[assignment.course_id]}` : 'Course unknown'}
            {assignment.html_url ? (
              <>
                {' '}
                ·{' '}
                <a href={assignment.html_url} target="_blank" rel="noreferrer">
                  Open in Canvas
                </a>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
