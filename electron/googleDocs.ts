import { app, BrowserWindow } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAssignmentExportInfo, saveGoogleDocInfo } from './assignmentExports';
import { mainError, mainLog } from './logger';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DOCS_ENDPOINT = 'https://docs.googleapis.com/v1/documents';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
];

const KEYTAR_SERVICE = 'DueD8';
const KEYTAR_ACCOUNT = 'google-docs-refresh-token';

let cachedTokens: {
  accessToken: string;
  refreshToken: string | null;
  expiry: number;
} | null = null;

let keytarPromise: Promise<typeof import('keytar') | null> | null = null;

async function getKeytar() {
  if (!keytarPromise) {
    keytarPromise = import('keytar').catch((error) => {
      mainError('Keytar unavailable, falling back to filesystem storage', error as Error);
      return null;
    });
  }
  return keytarPromise;
}

async function getFallbackPath() {
  const dir = path.join(app.getPath('userData'), 'auth');
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'google-refresh-token');
}

async function loadStoredRefreshToken(): Promise<string | null> {
  const keytar = await getKeytar();
  if (keytar) {
    const value = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (value) {
      return value;
    }
  }
  try {
    const fallbackPath = await getFallbackPath();
    const value = await fs.readFile(fallbackPath, 'utf8');
    return value.trim() || null;
  } catch {
    return null;
  }
}

async function storeRefreshToken(token: string | null) {
  const keytar = await getKeytar();
  if (keytar) {
    if (token) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token);
    } else {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    }
  } else {
    const fallbackPath = await getFallbackPath();
    if (token) {
      await fs.writeFile(fallbackPath, token, 'utf8');
    } else {
      try {
        await fs.unlink(fallbackPath);
      } catch {
        // ignore
      }
    }
  }
}

function buildAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function requestTokens(payload: Record<string, string>) {
  const body = new URLSearchParams({
    ...payload,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? ''
  });
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google token request failed: ${response.status} ${message}`);
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

async function startOAuthFlow(): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiry: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  const state = crypto.randomUUID();

  const server = http.createServer();
  const codePromise = new Promise<string>((resolve, reject) => {
    server.on('request', (req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Invalid request.');
        return;
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const incomingState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (incomingState !== state) {
        res.writeHead(400);
        res.end('State mismatch.');
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      if (error) {
        res.writeHead(400);
        res.end('Authorization failed. You can close this window.');
        reject(new Error(`Google authorization failed: ${error}`));
        return;
      }
      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code.');
        reject(new Error('Missing authorization code.'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family: sans-serif;">Google connection complete. You may close this window.</body></html>');
      resolve(code);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to initialise OAuth listener.');
  }
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;

  const authUrl = buildAuthUrl(redirectUri, state);
  const authWindow = new BrowserWindow({
    width: 520,
    height: 680,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const cleanup = () => {
    server.close();
    if (!authWindow.isDestroyed()) {
      authWindow.close();
    }
  };

  authWindow.on('closed', () => {
    cleanup();
  });

  await authWindow.loadURL(authUrl);

  try {
    const code = await codePromise;
    cleanup();
    const tokenResponse = await requestTokens({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
    const expiresIn = Number(tokenResponse.expires_in ?? 0);
    cachedTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      expiry: Date.now() + expiresIn * 1000
    };
    if (tokenResponse.refresh_token) {
      await storeRefreshToken(tokenResponse.refresh_token);
    }
    return cachedTokens;
  } finally {
    cleanup();
  }
}

async function refreshAccessToken(refreshToken: string) {
  const response = await requestTokens({
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const expiresIn = Number(response.expires_in ?? 0);
  cachedTokens = {
    accessToken: response.access_token,
    refreshToken,
    expiry: Date.now() + expiresIn * 1000
  };
  return cachedTokens;
}

async function ensureAccessToken(): Promise<string> {
  if (cachedTokens && cachedTokens.expiry - 60_000 > Date.now()) {
    return cachedTokens.accessToken;
  }
  const stored = cachedTokens?.refreshToken ?? (await loadStoredRefreshToken());
  if (stored) {
    try {
      const tokens = await refreshAccessToken(stored);
      return tokens.accessToken;
    } catch (error) {
      mainError('Refreshing Google token failed, requesting new auth', error as Error);
      await storeRefreshToken(null);
      cachedTokens = null;
    }
  }
  const tokens = await startOAuthFlow();
  return tokens.accessToken;
}

async function requestGoogleApi<T>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const accessToken = await ensureAccessToken();
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 401) {
    await storeRefreshToken(null);
    cachedTokens = null;
    throw new Error('Google authorization expired. Please try again.');
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google API request failed: ${response.status} ${message}`);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
}

export async function createAssignmentGoogleDoc(payload: {
  assignmentId: number;
  title: string;
  content: string;
}): Promise<{ documentId: string; documentUrl: string }> {
  const { assignmentId, title, content } = payload;

  const existing = getAssignmentExportInfo(assignmentId);
  if (existing.googleDocId && existing.googleDocUrl) {
    return { documentId: existing.googleDocId, documentUrl: existing.googleDocUrl };
  }

  const createResponse = await requestGoogleApi<{ documentId: string; documentUrl: string }>(
    GOOGLE_DOCS_ENDPOINT,
    {
      method: 'POST',
      body: {
        title: title.trim().length ? title.trim() : 'DueD8 Submission'
      }
    }
  );

  if (!createResponse.documentId) {
    throw new Error('Google Docs did not return a document identifier.');
  }

  await requestGoogleApi(
    `${GOOGLE_DOCS_ENDPOINT}/${createResponse.documentId}:batchUpdate`,
    {
      method: 'POST',
      body: {
        requests: [
          {
            insertText: {
              endOfSegmentLocation: {},
              text: content.endsWith('\n') ? content : `${content}\n`
            }
          }
        ]
      }
    }
  );

  const docUrl = createResponse.documentUrl
    ? createResponse.documentUrl
    : `https://docs.google.com/document/d/${createResponse.documentId}/edit`;

  saveGoogleDocInfo(assignmentId, createResponse.documentId, docUrl);

  mainLog('Created Google Doc for assignment', assignmentId, docUrl);

  return { documentId: createResponse.documentId, documentUrl: docUrl };
}
