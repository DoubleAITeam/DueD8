import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { rendererError, rendererLog } from '../lib/logger';
import { getPlatformBridge } from '../lib/platformBridge';
import ConnectCanvas from './pages/ConnectCanvas';
import { AppRoutes } from './routes/appRoutes';
import type { Profile } from './state/store';
import { useStore } from './state/store';
import { ThemeProvider } from './context/ThemeContext';

const platformBridge = getPlatformBridge();
// PHASE 1: Load the refreshed font stack and palette for the renderer.
import './styles/global.css';

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
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: 'var(--shadow-soft)',
        maxWidth: 320,
        border: '1px solid var(--surface-border)'
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
        const tokenResult = await platformBridge.canvas.getToken();
        if (!tokenResult.ok) {
          rendererError('Failed to read stored token', tokenResult.error);
          return;
        }
        if (!tokenResult.data) {
          rendererLog('No stored token found on startup');
          return;
        }

        const validation = await platformBridge.canvas.testToken();
        if (validation.ok) {
          rendererLog('Stored token validated on startup');
          const profile = (validation.data.profile ?? null) as Profile | null;
          setProfile(profile);
          setConnected(true);
        } else {
          rendererError('Stored token invalid', validation.status ?? 'unknown');
          await platformBridge.canvas.clearToken();
          setToast('Stored Canvas token expired. Reconnect using the help guide.');
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
          background: 'var(--surface-background)',
          color: 'var(--text-secondary)',
          fontSize: 18
        }}
      >
        Checking Canvas token…
      </div>
    );
  }

  return (
    <>
      {connected ? <AppRoutes /> : <ConnectCanvas />}
      <Toast />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <Root />
  </ThemeProvider>
);
