import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getPlatformBridge } from '../../lib/platformBridge';
import { useStore } from '../state/store';

const dued8 = getPlatformBridge();

function maskToken(length: number): string {
  if (length <= 0) {
    return '';
  }
  if (length <= 8) {
    return '•'.repeat(length);
  }
  return `${'•'.repeat(8)}…`;
}

type TestState = 'idle' | 'success' | 'unauthorized' | 'network';

export default function Settings(): JSX.Element {
  const setToast = useStore((s) => s.setToast);
  const [storedTokenLength, setStoredTokenLength] = useState<number>(0);
  const [loadingStoredToken, setLoadingStoredToken] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>('idle');
  const [revealLoading, setRevealLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadStoredToken() {
      setLoadingStoredToken(true);
      try {
        const response = await dued8.canvas.getToken();
        if (!active) return;
        if (response.ok && typeof response.data === 'string' && response.data) {
          setStoredTokenLength(response.data.length);
        } else {
          setStoredTokenLength(0);
        }
      } catch {
        if (active) {
          setStoredTokenLength(0);
        }
      } finally {
        if (active) {
          setLoadingStoredToken(false);
        }
      }
    }

    loadStoredToken();

    return () => {
      active = false;
    };
  }, []);

  const hasStoredToken = storedTokenLength > 0;

  const maskedValue = useMemo(() => {
    if (!hasStoredToken) {
      return '';
    }
    return maskToken(storedTokenLength);
  }, [hasStoredToken, storedTokenLength]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setError(null);
  }, []);

  const handleRevealToggle = useCallback(async () => {
    if (isRevealed) {
      setIsRevealed(false);
      if (revealedToken && inputValue === revealedToken) {
        setInputValue('');
      }
      setRevealedToken(null);
      return;
    }

    setRevealLoading(true);
    try {
      const response = await dued8.canvas.getToken();
      if (response.ok && typeof response.data === 'string' && response.data) {
        setInputValue(response.data);
        setRevealedToken(response.data);
        setIsRevealed(true);
      } else {
        setToast('No Canvas token saved to reveal.');
      }
    } catch {
      setToast('Unable to read Canvas token.');
    } finally {
      setRevealLoading(false);
    }
  }, [inputValue, isRevealed, revealedToken, setToast]);

  const handleSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) {
        setError('Enter a token before saving.');
        return;
      }

      setSaving(true);
      setError(null);
      try {
        const result = await dued8.canvas.setToken(trimmed);
        if (result.ok) {
          setStoredTokenLength(trimmed.length);
          setToast('Canvas token saved.');
          setInputValue('');
          setIsRevealed(false);
          setRevealedToken(null);
          setTestState('idle');
        } else {
          setError(result.error ?? 'Unable to store token.');
          setToast('Unable to store token securely.');
        }
      } catch {
        setError('Unexpected error saving token.');
        setToast('Unable to store token securely.');
      } finally {
        setSaving(false);
      }
    },
    [inputValue, setToast]
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestState('idle');
    try {
      const result = await dued8.canvas.testToken();
      if (result.ok) {
        setTestState('success');
        setToast('Canvas token is valid.');
      } else if (result.status === 401) {
        setTestState('unauthorized');
        setToast('Canvas rejected the token (401).');
      } else {
        setTestState('network');
        setToast('Unable to reach Canvas.');
      }
    } catch {
      setTestState('network');
      setToast('Unable to reach Canvas.');
    } finally {
      setTesting(false);
    }
  }, [setToast]);

  const testLabel = useMemo(() => {
    switch (testState) {
      case 'success':
        return 'Last test: Success';
      case 'unauthorized':
        return 'Last test: Unauthorized (401)';
      case 'network':
        return 'Last test: Network error';
      default:
        return null;
    }
  }, [testState]);

  const canTest = hasStoredToken || Boolean(inputValue.trim());

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '32px auto',
        padding: 32,
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        background: '#fff',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Settings</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Manage your Canvas connection. Your token is stored securely and never logged.
        </p>
      </header>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 500, color: '#1e293b' }}>Canvas API token</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={isRevealed ? 'text' : 'password'}
              value={inputValue}
              onChange={handleInputChange}
              placeholder={hasStoredToken && !inputValue ? maskedValue : loadingStoredToken ? 'Loading…' : 'Paste token'}
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #cbd5f5',
                fontSize: 16,
                background: '#f8fafc'
              }}
            />
            <button
              type="button"
              onClick={handleRevealToggle}
              disabled={revealLoading || (!hasStoredToken && !inputValue)}
              style={{
                borderRadius: 12,
                padding: '10px 14px',
                border: '1px solid #cbd5f5',
                background: isRevealed ? '#4338ca' : '#fff',
                color: isRevealed ? '#fff' : '#4338ca',
                fontWeight: 600,
                cursor: revealLoading ? 'wait' : 'pointer'
              }}
            >
              {revealLoading ? 'Loading…' : isRevealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
          {hasStoredToken && !inputValue && !isRevealed ? (
            <span style={{ color: '#64748b', fontSize: 13 }}>
              Stored token: {maskedValue || 'hidden'}
            </span>
          ) : null}
          {error ? (
            <span role="alert" style={{ color: '#dc2626', fontSize: 14 }}>
              {error}
            </span>
          ) : null}
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            disabled={saving || !inputValue.trim()}
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer'
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !canTest}
            style={{
              background: '#fff',
              color: '#2563eb',
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid #93c5fd',
              fontWeight: 600,
              cursor: testing ? 'wait' : 'pointer'
            }}
          >
            {testing ? 'Testing…' : 'Test token'}
          </button>
        </div>
      </form>

      {testLabel ? (
        <div style={{ color: '#475569', fontSize: 14 }}>{testLabel}</div>
      ) : null}
    </div>
  );
}
