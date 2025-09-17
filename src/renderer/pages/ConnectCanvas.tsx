import React, { useState } from 'react';
import { rendererError, rendererLog } from '../../lib/logger';
import type { Profile } from '../state/store';
import { useStore } from '../state/store';

const dued8 = window.dued8;

export default function ConnectCanvas() {
  const setConnected = useStore((s) => s.setConnected);
  const setProfile = useStore((s) => s.setProfile);
  const setToast = useStore((s) => s.setToast);
  const navigateToDashboard = useStore((s) => s.navigateToDashboard);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed || loading) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const saveResult = await dued8.canvas.setToken(trimmed);
      if (!saveResult.ok) {
        rendererError('Failed saving token', saveResult.error);
        setError(saveResult.error);
        setToast('Unable to store token securely.');
        return;
      }

      const validation = await dued8.canvas.testToken();
        if (validation.ok) {
          rendererLog('Canvas token validated successfully');
          const profile = (validation.data.profile ?? null) as Profile | null;
          setProfile(profile);
          setConnected(true);
          setToast('Canvas connected');
          navigateToDashboard();
      } else {
        const status = validation.status ?? 'unknown';
        const message = `Canvas rejected the token (status ${status}).`;
        setError(message);
        setToast('Canvas token invalid.');
        await dued8.canvas.clearToken();
        setProfile(null);
      }
    } catch (err) {
      rendererError('Unexpected connect error', err);
      setError('Unexpected error validating token.');
      setToast('Unable to contact Canvas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 45px rgba(15,23,42,0.12)',
          padding: '48px 40px',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Connect to Canvas</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Paste your personal access token. We will test it securely and never log the value.
          </p>
        </header>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Canvas access token</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste access token here"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              fontSize: 16
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!token.trim() || loading}
          style={{
            background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'background 0.2s ease'
          }}
        >
          {loading ? 'Testing token…' : 'Save & Test'}
        </button>
        {error && (
          <div role="status" aria-live="assertive" style={{ color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}
        <small style={{ color: '#64748b' }}>
          Need help? In Canvas, go to <strong>Account → Settings → New Access Token</strong>. Give it a name, copy the
          token once, and paste it here.
        </small>
      </form>
    </div>
  );
}