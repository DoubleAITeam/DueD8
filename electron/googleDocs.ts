import { BrowserWindow, shell } from 'electron';
import http from 'node:http';
import { getDb } from './db';
import { getRefreshToken, saveRefreshToken } from './googleTokenStore';
import { mainError, mainLog } from './logger';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DOCS_URL = 'https://docs.googleapis.com/v1/documents';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file'
];

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? '';
}

function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? '';
}

export type GoogleDocRecord = {
  assignmentId: number;
  courseId?: number | null;
  documentId: string;
  documentUrl: string;
};

export async function getExistingDocument(assignmentId: number): Promise<GoogleDocRecord | null> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT assignment_id as assignmentId, course_id as courseId, document_id as documentId, document_url as documentUrl
         FROM assignment_document WHERE assignment_id = ?`
    )
    .get(assignmentId) as GoogleDocRecord | undefined;
  return row ?? null;
}

function upsertDocumentRecord(record: GoogleDocRecord) {
  const db = getDb();
  db.prepare(
    `INSERT INTO assignment_document (assignment_id, course_id, document_id, document_url, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(assignment_id) DO UPDATE SET
         course_id = excluded.course_id,
         document_id = excluded.document_id,
         document_url = excluded.document_url,
         updated_at = datetime('now')`
  ).run(record.assignmentId, record.courseId ?? null, record.documentId, record.documentUrl);
}

function buildAuthUrl(clientId: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES.join(' ')
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((json.error_description as string) || 'Failed exchanging Google auth code');
  }
  const refreshToken = json.refresh_token as string | undefined;
  const accessToken = json.access_token as string | undefined;
  const expiresIn = Number(json.expires_in ?? 0);
  if (!refreshToken) {
    throw new Error('Google did not return a refresh token.');
  }
  return { refreshToken, accessToken, expiresIn };
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }).toString()
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((json.error_description as string) || 'Failed refreshing Google access token');
  }
  const accessToken = json.access_token as string | undefined;
  const expiresIn = Number(json.expires_in ?? 0);
  if (!accessToken) {
    throw new Error('Google did not return an access token.');
  }
  return { accessToken, expiresIn };
}

async function obtainAuthCode(clientId: string) {
  return new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end('Invalid request');
        return;
      }
      const target = new URL(req.url, 'http://localhost');
      if (target.pathname !== '/oauth2callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const code = target.searchParams.get('code');
      if (!code) {
        res.statusCode = 400;
        res.end('Missing code');
        reject(new Error('Google OAuth missing code'));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end('<html><body><h2>You may close this window.</h2></body></html>');
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
      }
      server.close();
      resolve({ code, redirectUri: currentRedirectUri });
    });

    let closed = false;
    let currentRedirectUri = '';
    let authWindow: BrowserWindow | null = null;

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind OAuth redirect server.'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
      currentRedirectUri = redirectUri;
      const authUrl = buildAuthUrl(clientId, redirectUri);
      authWindow = new BrowserWindow({
        width: 520,
        height: 680,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.on('closed', () => {
        closed = true;
        server.close();
        reject(new Error('Google sign-in window closed before completion.'));
      });

      authWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });

      authWindow
        .loadURL(authUrl)
        .catch((error) => {
          server.close();
          reject(error);
        });
    });

    server.on('close', () => {
      if (!closed) {
        closed = true;
      }
    });
  });
}

async function ensureAccessToken(account: string) {
  const clientId = getClientId();
  if (!clientId || !getClientSecret()) {
    throw new Error('Google OAuth client is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  let refreshToken = await getRefreshToken(account);

  if (!refreshToken) {
    const { code, redirectUri } = await obtainAuthCode(clientId);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    refreshToken = tokens.refreshToken;
    await saveRefreshToken(account, refreshToken);
    if (!tokens.accessToken) {
      return refreshAccessToken(refreshToken);
    }
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  return refreshAccessToken(refreshToken);
}

async function callGoogleApi<T>(url: string, accessToken: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    }
  });
  const text = await response.text();
  const json = text.length ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    mainError('Google API call failed', text);
    throw new Error('Google API call failed');
  }
  return json;
}

export async function createGoogleDocument(options: {
  assignmentId: number;
  courseId?: number | null;
  account: string;
  title: string;
  content: string;
}) {
  const { account, assignmentId, courseId, title, content } = options;
  const token = await ensureAccessToken(account);

  const createResponse = await callGoogleApi<{ documentId: string }>(GOOGLE_DOCS_URL, token.accessToken, {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  const documentId = createResponse.documentId;
  if (!documentId) {
    throw new Error('Google Docs did not return a document identifier.');
  }

  await callGoogleApi(
    `${GOOGLE_DOCS_URL}/${documentId}:batchUpdate`,
    token.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content.endsWith('\n') ? content : `${content}\n`
            }
          }
        ]
      })
    }
  );

  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  upsertDocumentRecord({ assignmentId, courseId, documentId, documentUrl });
  mainLog('Created Google Doc for assignment', assignmentId, documentId);
  return { documentId, documentUrl };
}
