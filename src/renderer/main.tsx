import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { rendererError, rendererLog } from '../lib/logger';
import ConnectCanvas from './pages/ConnectCanvas';
import Dashboard from './pages/Dashboard';
import ChatbotHost from './components/ChatbotHost';
import type { Profile } from './state/store';
import { useStore } from './state/store';

function Toast() {
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: '#0f172a',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: '0 12px 30px rgba(15,23,42,0.3)',
        maxWidth: 320
      }}
    >
      {toast}
    </div>
  );
}

function Root() {
  const connected = useStore((s) => s.connected);
  const setConnected = useStore((s) => s.setConnected);
  const setProfile = useStore((s) => s.setProfile);
  const setToast = useStore((s) => s.setToast);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const tokenResult = await window.dued8.canvas.getToken();
        if (!tokenResult.ok) {
          rendererError('Failed to read stored token', tokenResult.error);
          return;
        }
        if (!tokenResult.data) {
          rendererLog('No stored token found on startup');
          return;
        }

        const validation = await window.dued8.canvas.testToken();
        if (validation.ok) {
          rendererLog('Stored token validated on startup');
          const profile = (validation.data.profile ?? null) as Profile | null;
          setProfile(profile);
          setConnected(true);
        } else {
          rendererError('Stored token invalid', validation.status ?? 'unknown');
          await window.dued8.canvas.clearToken();
          setToast('Stored Canvas token is invalid. Please reconnect.');
        }
      } catch (error) {
        rendererError('Bootstrap token check failed', error);
        setToast('Unable to verify saved Canvas token.');
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setConnected, setProfile, setToast]);

  if (initializing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontSize: 18
        }}
      >
        Checking Canvas token…
      </div>
    );
  }

  return (
    <>
      {connected ? <Dashboard /> : <ConnectCanvas />}
      <Toast />
      <ChatbotHost />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);