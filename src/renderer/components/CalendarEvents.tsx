import React from 'react';
import type { CalendarEvent } from '../../lib/canvasClient';

type Props = {
  events: CalendarEvent[];
  loading?: boolean;
};

export default function CalendarEvents({ events, loading }: Props) {
  if (loading) return <p>Loading calendar…</p>;
  if (!events?.length) return <p>No events in this window.</p>;

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const dateKey = new Date(event.start_at).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const orderedDates = Object.keys(grouped).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {orderedDates.map((day) => (
        <div key={day}>
          <h4 style={{ margin: '0 0 6px 0' }}>{day}</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {grouped[day].map((event) => (
              <li key={event.id} style={{ marginBottom: 6 }}>
                <strong>{event.title}</strong>{' '}
                <span style={{ color: '#475569', fontSize: 13 }}>
                  {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {event.context_name ? (
                  <span style={{ color: '#64748b', fontSize: 12 }}> · {event.context_name}</span>
                ) : null}
                {event.html_url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={event.html_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
