import { app, BrowserWindow } from 'electron';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { mainError, mainLog } from './logger';

const SERVICE = 'DueD8';
const ACCOUNT = 'google-oauth';

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
];

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const tokenFile = () => path.join(app.getPath('userData'), 'google-oauth.enc');
const keyFile = () => path.join(app.getPath('userData'), 'google-oauth.key');

const KEYTAR_MODULE = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (eval('require') as NodeRequire)('keytar') as {
      getPassword(service: string, account: string): Promise<string | null>;
      setPassword(service: string, account: string, password: string): Promise<void>;
      deletePassword(service: string, account: string): Promise<boolean>;
    };
  } catch (error) {
    mainLog('keytar unavailable for Google OAuth:', (error as Error).message);
    return null;
  }
})();

type StoredGoogleTokens = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  expires_in?: number;
};

async function ensureKey(): Promise<Buffer> {
  try {
    const existing = await fs.readFile(keyFile());
    if (existing.length === KEY_LENGTH) {
      return existing;
    }
  } catch {
    // ignored
  }
  const fresh = crypto.randomBytes(KEY_LENGTH);
  await fs.writeFile(keyFile(), fresh, { mode: 0o600 });
  return fresh;
}

async function writeEncryptedSecret(secret: string) {
  const key = await ensureKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: tag.toString('hex')
  });
  await fs.writeFile(tokenFile(), payload, { mode: 0o600 });
}

async function readEncryptedSecret(): Promise<string | null> {
  try {
    const raw = await fs.readFile(tokenFile(), 'utf8');
    const parsed = JSON.parse(raw) as { iv: string; data: string; tag: string };
    const key = await ensureKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('Failed to read encrypted Google tokens:', (error as Error).message);
    }
    return null;
  }
}

async function clearEncryptedSecret() {
  try {
    await fs.unlink(tokenFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('Failed to delete encrypted Google tokens:', (error as Error).message);
    }
  }
}

async function storeTokens(tokens: StoredGoogleTokens) {
  const serialised = JSON.stringify(tokens);
  if (KEYTAR_MODULE) {
    try {
      await KEYTAR_MODULE.setPassword(SERVICE, ACCOUNT, serialised);
      return;
    } catch (error) {
      mainError('keytar.setPassword for Google tokens failed:', (error as Error).message);
    }
  }
  await writeEncryptedSecret(serialised);
}

async function loadTokens(): Promise<StoredGoogleTokens | null> {
  if (KEYTAR_MODULE) {
    try {
      const value = await KEYTAR_MODULE.getPassword(SERVICE, ACCOUNT);
      if (value) {
        return JSON.parse(value) as StoredGoogleTokens;
      }
    } catch (error) {
      mainError('keytar.getPassword for Google tokens failed:', (error as Error).message);
    }
  }
  const fallback = await readEncryptedSecret();
  if (!fallback) {
    return null;
  }
  try {
    return JSON.parse(fallback) as StoredGoogleTokens;
  } catch (error) {
    mainError('Failed to parse stored Google tokens:', (error as Error).message);
    return null;
  }
}

async function clearStoredTokens() {
  if (KEYTAR_MODULE) {
    try {
      await KEYTAR_MODULE.deletePassword(SERVICE, ACCOUNT);
    } catch (error) {
      mainError('keytar.deletePassword for Google tokens failed:', (error as Error).message);
    }
  }
  await clearEncryptedSecret();
}

function withExpiry(tokens: StoredGoogleTokens): StoredGoogleTokens {
  if (tokens.expires_in && (!tokens.expiry_date || tokens.expiry_date <= Date.now())) {
    return { ...tokens, expiry_date: Date.now() + tokens.expires_in * 1000 };
  }
  return tokens;
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<StoredGoogleTokens> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to exchange Google auth code (${response.status}): ${message}`);
  }
  const tokens = (await response.json()) as StoredGoogleTokens;
  if (!tokens.refresh_token) {
    throw new Error('Google did not provide a refresh token. Ensure access_type=offline and prompt=consent are configured.');
  }
  return withExpiry(tokens);
}

async function refreshTokens(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<StoredGoogleTokens> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to refresh Google token (${response.status}): ${message}`);
  }
  const tokens = (await response.json()) as StoredGoogleTokens;
  tokens.refresh_token = tokens.refresh_token ?? refreshToken;
  return withExpiry(tokens);
}

async function performInteractiveAuth(
  clientId: string,
  clientSecret: string
): Promise<StoredGoogleTokens> {
  const state = crypto.randomBytes(16).toString('hex');
  const server = http.createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address && 'port' in address) {
        resolve(address.port);
      } else {
        reject(new Error('Failed to allocate local OAuth port'));
      }
    });
  });
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/oauth2callback`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const authWindow = new BrowserWindow({
    width: 560,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const codePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Google OAuth timed out. Close the window and try again.'));
    }, 5 * 60 * 1000);

    server.on('request', (req, res) => {
      if (!req.url) {
        return;
      }
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== new URL(redirectUri).pathname) {
        res.writeHead(404);
        res.end();
        return;
      }
      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch. Close this window and try again.');
        reject(new Error('Google OAuth state mismatch'));
        return;
      }
      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(400);
        res.end('Authorization failed. You can close this window.');
        reject(new Error(`Google OAuth error: ${error}`));
        return;
      }
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code.');
        reject(new Error('Google OAuth missing code'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorization complete</h2><p>You can close this window.</p></body></html>');
      clearTimeout(timeout);
      resolve(code);
    });

    authWindow.on('closed', () => {
      clearTimeout(timeout);
      reject(new Error('Google OAuth window closed before completion'));
    });
  });

  authWindow.loadURL(authUrl.toString()).catch((error) => {
    mainError('Failed to load Google OAuth URL:', (error as Error).message);
  });

  try {
    const code = await codePromise;
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    await storeTokens(tokens);
    return tokens;
  } finally {
    server.close();
    if (!authWindow.isDestroyed()) {
      authWindow.close();
    }
  }
}

export async function ensureGoogleAccessToken(): Promise<{
  accessToken: string;
  tokens: StoredGoogleTokens;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  }

  let tokens = await loadTokens();
  if (tokens?.access_token && tokens.expiry_date && tokens.expiry_date - 60_000 > Date.now()) {
    return { accessToken: tokens.access_token, tokens };
  }

  if (tokens?.refresh_token) {
    try {
      tokens = await refreshTokens(tokens.refresh_token, clientId, clientSecret);
      await storeTokens(tokens);
      if (tokens.access_token) {
        return { accessToken: tokens.access_token, tokens };
      }
    } catch (error) {
      mainError('Google token refresh failed:', (error as Error).message);
      await clearStoredTokens();
      tokens = null;
    }
  }

  const fresh = await performInteractiveAuth(clientId, clientSecret);
  await storeTokens(fresh);
  if (!fresh.access_token) {
    throw new Error('Google OAuth succeeded but no access token was returned.');
  }
  return { accessToken: fresh.access_token, tokens: fresh };
}

export async function hasGoogleCredentials(): Promise<boolean> {
  const tokens = await loadTokens();
  return Boolean(tokens?.access_token || tokens?.refresh_token);
}
