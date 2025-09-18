import React from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { BinderAppShell } from './components/binder/BinderAppShell';
import { isFeatureEnabled } from './config/featureFlags';
import AssignmentPage from './pages/Assignment';
import ClassPage from './pages/Class';
import Dashboard from './pages/Dashboard';
import { useUIStore } from './state/uiStore';

const linkStyles: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  textDecoration: 'none'
};

function LegacyTopBar() {
  const chatOpen = useUIStore((state) => state.chatOpen);
  const unreadCount = useUIStore((state) => state.unreadCount);
  const openChat = useUIStore((state) => state.openChat);
  const minimizeChat = useUIStore((state) => state.minimizeChat);
  const clearUnread = useUIStore((state) => state.clearUnread);

  const toggleChat = () => {
    if (chatOpen) {
      minimizeChat();
    } else {
      openChat();
      clearUnread();
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}
    >
      <nav style={{ display: 'flex', gap: 12 }}>
        <NavLink
          to="/"
          style={({ isActive }) => ({
            ...linkStyles,
            color: isActive ? '#0f172a' : '#64748b',
            backgroundColor: isActive ? '#e2e8f0' : 'transparent',
            fontWeight: isActive ? 600 : 500
          })}
          end
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/class/it223"
          style={({ isActive }) => ({
            ...linkStyles,
            color: isActive ? '#0f172a' : '#64748b',
            backgroundColor: isActive ? '#e2e8f0' : 'transparent',
            fontWeight: isActive ? 600 : 500
          })}
        >
          Sample Course
        </NavLink>
      </nav>
      <button
        type="button"
        onClick={toggleChat}
        style={{
          border: '1px solid #cbd5f5',
          backgroundColor: chatOpen ? '#4338ca' : '#ffffff',
          color: chatOpen ? '#e2e8f0' : '#4338ca',
          borderRadius: 999,
          padding: '8px 16px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {chatOpen ? 'Hide Assistant' : 'Open Assistant'}
        {!chatOpen && unreadCount > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              padding: '2px 6px',
              borderRadius: 999,
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>
    </header>
  );
}

function LegacyContentArea() {
  return (
    <main
      style={{
        padding: '32px 24px',
        maxWidth: 960,
        margin: '0 auto',
        width: '100%'
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/class/:classId" element={<ClassPage />} />
        <Route path="/class/:classId/assignment/:assignmentId" element={<AssignmentPage />} />
      </Routes>
    </main>
  );
}

function LegacyAppShell() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        color: '#0f172a'
      }}
    >
      <LegacyTopBar />
      <LegacyContentArea />
    </div>
  );
}

export default function App() {
  const binderPreviewEnabled = isFeatureEnabled('ui.binderPreview');

  return <BrowserRouter>{binderPreviewEnabled ? <BinderAppShell /> : <LegacyAppShell />}</BrowserRouter>;
}
