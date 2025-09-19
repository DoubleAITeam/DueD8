import { app, BrowserWindow } from 'electron';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { ensureAssignmentRecord, getAssignmentRecordByCanvasId, updateAssignmentGoogleDoc } from './tokenService';
import { mainError, mainLog } from './logger';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

const SERVICE = 'DueD8';
const ACCOUNT = 'google-refresh-token';

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const tokenFile = () => path.join(app.getPath('userData'), 'google-refresh-token.enc');
const keyFile = () => path.join(app.getPath('userData'), 'google-refresh-token.key');

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
];

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

let keytar: KeytarModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = (eval('require') as NodeRequire)('keytar') as KeytarModule;
  mainLog('googleService keytar module loaded');
} catch (error) {
  mainLog('googleService keytar unavailable, falling back to encrypted storage:', (error as Error).message);
  keytar = null;
}

async function ensureKey(): Promise<Buffer> {
  try {
    const existing = await fs.readFile(keyFile());
    if (existing.length === KEY_LENGTH) {
      return existing;
    }
  } catch {
    // ignore
  }
  const fresh = crypto.randomBytes(KEY_LENGTH);
  await fs.writeFile(keyFile(), fresh, { mode: 0o600 });
  return fresh;
}

async function writeEncryptedToken(token: string) {
  const key = await ensureKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: authTag.toString('hex')
  });
  await fs.writeFile(tokenFile(), payload, { mode: 0o600 });
}

async function readEncryptedToken(): Promise<string | null> {
  try {
    const key = await ensureKey();
    const raw = await fs.readFile(tokenFile(), 'utf8');
    const parsed = JSON.parse(raw) as { iv: string; data: string; tag: string };
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('readEncryptedToken failed', (error as Error).message);
    }
    return null;
  }
}

async function clearEncryptedToken() {
  try {
    await fs.unlink(tokenFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('clearEncryptedToken failed', (error as Error).message);
    }
  }
}

export async function setRefreshToken(token: string) {
  const cleaned = token.trim();
  if (!cleaned) {
    throw new Error('Refresh token must be provided');
  }
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, ACCOUNT, cleaned);
      return;
    } catch (error) {
      mainError('keytar.setPassword for google failed, falling back:', (error as Error).message);
    }
  }
  await writeEncryptedToken(cleaned);
}

export async function getRefreshToken(): Promise<string | null> {
  if (keytar) {
    try {
      const value = await keytar.getPassword(SERVICE, ACCOUNT);
      if (value) {
        return value;
      }
    } catch (error) {
      mainError('keytar.getPassword for google failed:', (error as Error).message);
    }
  }
  return readEncryptedToken();
}

export async function clearRefreshToken() {
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, ACCOUNT);
    } catch (error) {
      mainError('keytar.deletePassword for google failed:', (error as Error).message);
    }
  }
  await clearEncryptedToken();
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth configuration. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

function buildAuthUrl(clientId: string, redirectUri: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function requestToken(body: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok) {
    const message = payload.error_description || payload.error || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload;
}

async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getClientCredentials();
  return requestToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getClientCredentials();
  const response = await requestToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  if (!response.access_token) {
    throw new Error('Failed to refresh Google access token.');
  }
  return response.access_token;
}

export async function isGoogleConnected() {
  const token = await getRefreshToken();
  return Boolean(token);
}

async function performInteractiveAuth(): Promise<{ refreshToken: string; accessToken: string | null }> {
  const { clientId } = getClientCredentials();
  const server = http.createServer();
  let redirectUriUsed: string | null = null;

  try {
    const authResult = await new Promise<{ code: string }>((resolve, reject) => {
      let resolved = false;
      let authWindow: BrowserWindow | null = null;

      server.on('request', (req, res) => {
        if (!req.url) {
          res.writeHead(400);
          res.end('Invalid request');
          return;
        }
        const requestUrl = new URL(req.url, `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
        if (requestUrl.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const code = requestUrl.searchParams.get('code');
        const error = requestUrl.searchParams.get('error');
        if (error) {
          res.writeHead(500);
          res.end('Authorization error');
          if (!resolved) {
            resolved = true;
            reject(new Error(`Google authorization error: ${error}`));
          }
          return;
        }
        if (!code) {
          res.writeHead(400);
          res.end('Missing authorization code');
          if (!resolved) {
            resolved = true;
            reject(new Error('Google authorization code missing'));
          }
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><script>window.close();</script>Authentication complete. You can close this window.</body></html>');
        if (authWindow) {
          authWindow.close();
        }
        if (!resolved) {
          resolved = true;
          resolve({ code });
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        if (!address || typeof address.port !== 'number') {
          reject(new Error('Failed to bind local OAuth port'));
          return;
        }
        redirectUriUsed = `http://127.0.0.1:${address.port}/oauth2callback`;
        const authUrl = buildAuthUrl(clientId, redirectUriUsed);
        authWindow = new BrowserWindow({
          width: 520,
          height: 640,
          resizable: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });
        authWindow.on('closed', () => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Google authorization window closed'));
          }
        });
        authWindow.loadURL(authUrl).catch((error) => {
          mainError('Failed loading Google auth URL', (error as Error).message);
        });
      });
    });

    const redirectUri = redirectUriUsed ?? 'http://127.0.0.1/oauth2callback';
    const tokens = await exchangeAuthorizationCode(authResult.code, redirectUri);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Ensure consent screen is approved.');
    }
    await setRefreshToken(tokens.refresh_token);
    return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token ?? null };
  } finally {
    server.close();
  }
}

async function getAuthenticatedTokens(): Promise<{ refreshToken: string; accessToken: string }> {
  const stored = await getRefreshToken();
  if (stored) {
    try {
      const accessToken = await refreshAccessToken(stored);
      return { refreshToken: stored, accessToken };
    } catch (error) {
      mainError('refreshAccessToken failed', (error as Error).message);
      await clearRefreshToken();
    }
  }
  const interactive = await performInteractiveAuth();
  const refreshToken = interactive.refreshToken;
  const accessToken = interactive.accessToken ?? (await refreshAccessToken(refreshToken));
  return { refreshToken, accessToken };
}

async function googleApiFetch<T>(pathname: string, options: {
  method?: 'GET' | 'POST';
  accessToken: string;
  body?: unknown;
}) {
  const response = await fetch(`https://docs.googleapis.com${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Docs API error ${response.status}: ${text}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function replaceDocumentContent(accessToken: string, documentId: string, text: string) {
  const doc = await googleApiFetch<{ body?: { content?: Array<{ endIndex?: number }> } }>(
    `/v1/documents/${documentId}`,
    { accessToken }
  );
  const endIndex = doc.body?.content?.reduce((max, element) => {
    const idx = element.endIndex ?? 1;
    return Math.max(max, idx);
  }, 1) ?? 1;
  const requests: Array<Record<string, unknown>> = [];
  if (endIndex > 1) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex
        }
      }
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text
    }
  });
  await googleApiFetch(`/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    accessToken,
    body: { requests }
  });
}

export async function createOrUpdateGoogleDoc(options: {
  canvasId: number;
  courseId: number;
  slug: string;
  title: string;
  content: string;
}) {
  const assignment = ensureAssignmentRecord(options.canvasId, options.courseId, options.slug);
  const { accessToken } = await getAuthenticatedTokens();

  let documentId = assignment.google_doc_id;
  if (!documentId) {
    const createResult = await googleApiFetch<{ documentId?: string }>('/v1/documents', {
      method: 'POST',
      accessToken,
      body: { title: options.title }
    });
    documentId = createResult.documentId ?? null;
    if (!documentId) {
      throw new Error('Failed to create Google Doc');
    }
  }

  await replaceDocumentContent(accessToken, documentId, options.content);

  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  updateAssignmentGoogleDoc(assignment.id, { documentId, documentUrl });

  return {
    documentId,
    documentUrl
  };
}

export function getAssignmentGoogleDoc(canvasId: number) {
  return getAssignmentRecordByCanvasId(canvasId);
}
