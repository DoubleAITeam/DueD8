import React from 'react';
import type { Assignment } from '../../lib/canvasClient';

type Props = {
  assignments: Assignment[];
  courseLookup?: Record<number, string>;
  loading?: boolean;
};

export default function AssignmentsList({ assignments, courseLookup = {}, loading }: Props) {
  if (loading) return <p>Loading assignments...</p>;
  if (!assignments?.length) return <p>No upcoming assignments.</p>;
  const sorted = [...assignments].sort((a, b) => {
    const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    return da - db;
  });
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {sorted.map((assignment) => (
        <li key={assignment.id} style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 600 }}>{assignment.name}</div>
          {assignment.due_at && (
            <div style={{ fontSize: 13, color: '#475569' }}>
              due {new Date(assignment.due_at).toLocaleString()}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#64748b' }}>
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
