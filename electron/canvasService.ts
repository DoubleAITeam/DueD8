import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { mainError, mainLog } from './logger';

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

const SERVICE = 'DueD8';
const ACCOUNT = 'canvas-token';

const HOSTS = ['https://canvas.gmu.edu', 'https://gmu.instructure.com'];

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const tokenFile = () => path.join(app.getPath('userData'), 'canvas-token.enc');
const keyFile = () => path.join(app.getPath('userData'), 'canvas-token.key');

let keytar: KeytarModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = (eval('require') as NodeRequire)('keytar') as KeytarModule;
  mainLog('keytar module loaded');
} catch (error) {
  mainLog('keytar unavailable, falling back to encrypted file storage:', (error as Error).message);
  keytar = null;
}

async function ensureKey(): Promise<Buffer> {
  try {
    const existing = await fs.readFile(keyFile());
    if (existing.length === KEY_LENGTH) {
      return existing;
    }
  } catch {
    // ignore, generate new key below
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
      mainError('readEncryptedToken failed:', (error as Error).message);
    }
    return null;
  }
}

async function clearEncryptedToken(): Promise<void> {
  try {
    await fs.unlink(tokenFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('clearEncryptedToken failed:', (error as Error).message);
    }
  }
}

/**
 * Persist the provided Canvas token, preferring keytar when available.
 */
export async function setToken(token: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  const cleaned = token.trim();
  if (!cleaned) {
    throw new Error('Token is empty');
  }

  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, ACCOUNT, cleaned);
      mainLog('Token stored via keytar');
      return;
    } catch (error) {
      mainError('keytar.setPassword failed, falling back:', (error as Error).message);
    }
  }

  await writeEncryptedToken(cleaned);
  mainLog('Token stored in encrypted fallback file');
}

/**
 * Retrieve the currently stored Canvas token, if any.
 */
export async function getToken(): Promise<string | null> {
  if (keytar) {
    try {
      const value = await keytar.getPassword(SERVICE, ACCOUNT);
      if (value) {
        return value;
      }
    } catch (error) {
      mainError('keytar.getPassword failed:', (error as Error).message);
    }
  }

  return readEncryptedToken();
}

/**
 * Remove the stored Canvas token from both keytar and the fallback file.
 */
export async function clearToken(): Promise<void> {
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, ACCOUNT);
    } catch (error) {
      mainError('keytar.deletePassword failed:', (error as Error).message);
    }
  }
  await clearEncryptedToken();
}

/**
 * Validate the stored token by requesting the Canvas profile endpoint.
 */
export async function validateToken(): Promise<{ ok: boolean; status: number; profile?: unknown; error?: string }> {
  const token = await getToken();
  if (!token) {
    return { ok: false, status: 0, error: 'missing-token' };
  }

  let lastStatus = 0;
  let lastError = 'Unknown error';
  for (const host of HOSTS) {
    try {
      const response = await fetch(`${host}/api/v1/users/self/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
      mainLog('validateToken host result', host, response.status);
      if (response.ok) {
        const profile = await response.json();
        return { ok: true, status: response.status, profile };
      }
      lastStatus = response.status;
      lastError = `${response.status} ${response.statusText}`;
      if (response.status === 401) {
        return { ok: false, status: response.status, error: 'unauthorized' };
      }
    } catch (error) {
      const message = (error as Error).message;
      mainError('validateToken request failed for host', host, message);
      lastError = message;
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}

type CanvasQueryValue = string | number | boolean | Array<string | number | boolean>;

export type CanvasGetPayload = {
  path: string;
  query?: Record<string, CanvasQueryValue>;
};

/**
 * Execute an authenticated GET request against the Canvas API with host failover.
 */
export async function fetchCanvasJson(
  payload: CanvasGetPayload
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const token = await getToken();
  if (!token) {
    return { ok: false, status: 401, error: 'Missing token' };
  }

  const { path: inputPath, query } = payload;
  const qs = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        value.forEach((item) => qs.append(key, String(item)));
      } else {
        qs.append(key, String(value));
      }
    }
  }
  const queryString = qs.toString();
  const finalPath = queryString ? `${inputPath}${inputPath.includes('?') ? '&' : '?'}${queryString}` : inputPath;

  let lastStatus = 0;
  let lastError = 'Unknown error';

  for (const host of HOSTS) {
    const url = `${host}${finalPath}`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
      mainLog('canvas:get host result', host, response.status);
      if (response.ok) {
        const data = await response.json();
        return { ok: true, status: response.status, data };
      }
      lastStatus = response.status;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastStatus = 0;
      lastError = (error as Error).message;
      mainError('canvas:get request failed for', url, lastError);
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}
