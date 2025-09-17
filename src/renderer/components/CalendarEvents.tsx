import React from 'react';
/* PHASE 1: Calendar view now consumes both Canvas events and assignment due dates. */
export type CalendarItem = {
  id: string;
  title: string;
  start_at: string;
  context_name?: string;
  html_url?: string;
  source: 'event' | 'assignment';
};

type Props = {
  events: CalendarItem[];
  loading?: boolean;
};

export default function CalendarEvents({ events, loading }: Props) {
  if (loading) return <p>Loading calendar…</p>;
  if (!events?.length) return <p>No events in this window.</p>;

  const grouped = events.reduce<Record<string, CalendarItem[]>>((acc, event) => {
    const date = new Date(event.start_at);
    if (Number.isNaN(date.getTime())) {
      return acc;
    }
    const dateKey = date.toDateString();
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
          <h4 style={{ margin: '0 0 6px 0', fontWeight: 600 }}>{day}</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grouped[day]
              .sort(
                (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
              )
              .map((event) => (
                <li
                  key={event.id}
                  style={{
                    listStyle: 'none',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    border: '1px solid rgba(15, 23, 42, 0.05)'
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>{event.title}</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {event.context_name ? (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}> · {event.context_name}</span>
                  ) : null}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}> · {event.source === 'assignment' ? 'Due' : 'Event'}</span>
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
