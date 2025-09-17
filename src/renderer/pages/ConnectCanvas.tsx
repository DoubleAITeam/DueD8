import React, { useState } from 'react';
import { useStore } from '../state/store';

const dued8: any = (window as any)?.dued8;

export default function ConnectCanvas() {
  const setConnected = useStore(s => s.setConnected);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  async function handleConnect() {
    if (!dued8 || !dued8.token) {
      alert('Bridge not ready. Restart app.');
      return;
    }
    const cleaned = token.trim();
    if (!cleaned) return;
    setErr(null);
    setLoading(true);
    try {
      await dued8.token.save(cleaned);
      // Verify against Canvas right away
      if (dued8.canvas?.testToken) {
        const res = await dued8.canvas.testToken();
        setProfile(res?.profile ?? null);
      }
      setConnected(true);
    } catch (e: any) {
      setErr(e?.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h1>Connect Canvas</h1>
      <p>Paste your Canvas Access Token to connect. We will verify it against Canvas immediately.</p>
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="Paste access token here"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{ width: '100%', marginBottom: 8, padding: 8 }}
      />
      <button disabled={!token.trim() || loading} onClick={handleConnect}>
        {loading ? 'Connecting…' : 'Connect'}
      </button>
      {err && <div role="status" aria-live="polite" style={{ color: 'crimson', marginTop: 10 }}>{err}</div>}
      {profile && (
        <div style={{ marginTop: 12, fontSize: 14 }}>
          <div style={{ fontWeight: 600 }}>Connected to Canvas</div>
          <div>Name: {profile.name ?? profile.short_name ?? 'Unknown'}</div>
          <div>User ID: {profile.id}</div>
        </div>
      )}
    </div>
  );
}