import React from 'react';
import type { Assignment } from '../../lib/canvasClient';

type Props = {
  assignments: Assignment[];
  courseLookup?: Record<number, string>;
  loading?: boolean;
  onSelect?: (assignment: Assignment) => void;
  emptyMessage?: string;
  sortDirection?: 'asc' | 'desc';
};

export default function AssignmentsList({
  assignments,
  courseLookup = {},
  loading,
  onSelect,
  emptyMessage = 'No upcoming assignments.',
  sortDirection = 'asc'
}: Props) {
  if (loading) return <p>Loading assignments...</p>;
  if (!assignments?.length) return <p>{emptyMessage}</p>;
  const sorted = [...assignments].sort((a, b) => {
    const fallback = sortDirection === 'asc' ? Infinity : -Infinity;
    const da = a.due_at ? new Date(a.due_at).getTime() : fallback;
    const db = b.due_at ? new Date(b.due_at).getTime() : fallback;
    const diff = da - db;
    return sortDirection === 'asc' ? diff : -diff;
  });
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map((assignment) => (
        <li
          key={assignment.id}
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid var(--surface-border)',
            background: 'rgba(255,255,255,0.75)',
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.05)',
            cursor: onSelect ? 'pointer' : 'default'
          }}
          // PHASE 2: Make each assignment interactive so users can open the upload workspace.
          onClick={onSelect ? () => onSelect(assignment) : undefined}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{assignment.name}</div>
          {assignment.due_at ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Due {new Date(assignment.due_at).toLocaleString()}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {/* PHASE 1: Provide clarity when Canvas omits due dates. */}
              No due date provided – check Canvas for details.
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
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
