import { useUIStore } from '../state/uiStore';

export default function Dashboard() {
  const unreadCount = useUIStore((state) => state.unreadCount);
  const incUnread = useUIStore((state) => state.incUnread);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Welcome to DueD8. This area will soon surface your upcoming coursework and quick actions.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#f1f5f9',
          borderRadius: 12,
          padding: '16px 20px',
          color: '#0f172a'
        }}
      >
        <span style={{ fontWeight: 600 }}>Unread Assistant Messages:</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 32,
          padding: '4px 10px',
          borderRadius: 999,
          background: unreadCount > 0 ? '#4338ca' : '#cbd5f5',
          color: unreadCount > 0 ? '#f8fafc' : '#1e293b',
          fontWeight: 700
        }}>
          {unreadCount}
        </span>
        <button
          type="button"
          onClick={incUnread}
          style={{
            marginLeft: 'auto',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #4338ca',
            background: '#4338ca',
            color: '#f8fafc',
            fontWeight: 600
          }}
        >
          Simulate New Message
        </button>
      </div>
    </div>
  );
}
