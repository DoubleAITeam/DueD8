import React, { useState } from 'react';
import { rendererError, rendererLog } from '../../lib/logger';
import { getPlatformBridge } from '../../lib/platformBridge';
import type { Profile } from '../state/store';
import { useStore } from '../state/store';

// PHASE 6: Use the shared bridge so future platforms can swap implementations.
const dued8 = getPlatformBridge();

export default function ConnectCanvas() {
  const setConnected = useStore((s) => s.setConnected);
  const setProfile = useStore((s) => s.setProfile);
  const setToast = useStore((s) => s.setToast);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PHASE 5: Provide an inline guide to help users locate their Canvas token.
  const [showGuide, setShowGuide] = useState(false);

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
        setShowGuide(false);
      } else {
        const status = validation.status ?? 'unknown';
        if (status === 401) {
          setError('Canvas reported this token as expired. Please generate a new one.');
          setToast('Canvas token expired. Follow the guide to create a fresh key.');
          setShowGuide(true);
        } else {
          const message = validation.error ?? `Canvas rejected the token (status ${status}).`;
          setError(message);
          setToast('Canvas token invalid.');
        }
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
      /* PHASE 1: Refresh connect screen with Apple-inspired neutrals. */
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-background)',
        padding: 24
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          /* PHASE 1: Simplify card styling for flatter presentation. */
          background: 'var(--surface-card)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          padding: '48px 44px',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          border: '1px solid var(--surface-border)'
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* PHASE 1: Align typography weights with new font stack. */}
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Connect to Canvas</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Paste your personal access token. We will test it securely and never log the value.
          </p>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              color: 'var(--accent)',
              border: 'none',
              padding: 0,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            {/* PHASE 5: Offer quick access to the token instructions. */}
            How do I find my access token?
          </button>
        </header>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Canvas access token</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste access token here"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid var(--surface-border)',
              background: 'rgba(255,255,255,0.9)',
              fontSize: 16,
              color: 'var(--text-primary)'
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!token.trim() || loading}
          style={{
            /* PHASE 1: Use softer accent styling inspired by macOS controls. */
            background: loading ? 'rgba(10, 132, 255, 0.6)' : 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            padding: '14px 16px',
            borderRadius: 14,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'background 0.2s ease, transform 0.2s ease',
            boxShadow: loading ? 'none' : '0 10px 20px rgba(10, 132, 255, 0.25)'
          }}
        >
          {loading ? 'Testing token…' : 'Save & Test'}
        </button>
        {error && (
          <div role="status" aria-live="assertive" style={{ color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}
        <small style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Need help? In Canvas, go to <strong>Account → Settings → New Access Token</strong>. Give it a name, copy the
          token once, and paste it here.
        </small>
      </form>
      {showGuide ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowGuide(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 10
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'var(--surface-card)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 420,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              border: '1px solid var(--surface-border)'
            }}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* PHASE 5: Modal instructions for retrieving the Canvas token. */}
              <h2 style={{ margin: 0, fontSize: 20 }}>Find your Canvas token</h2>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer'
                }}
                aria-label="Close token guide"
              >
                ×
              </button>
            </header>
            <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <li>Open Canvas in your browser and sign in.</li>
              <li>Select <strong>Account</strong> → <strong>Settings</strong>.</li>
              <li>Scroll to <strong>Approved Integrations</strong> and click <strong>+ New Access Token</strong>.</li>
              <li>Give the token a name, optionally set an expiry, then click <strong>Generate Token</strong>.</li>
              <li>Copy the token immediately and paste it back into DueD8.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '8px 16px',
                cursor: 'pointer'
              }}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}