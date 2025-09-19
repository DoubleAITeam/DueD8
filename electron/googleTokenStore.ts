import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

function resolveStorePaths() {
  const storeDir = path.join(app.getPath('userData'), 'secrets');
  const storeFile = path.join(storeDir, 'google-oauth.json');
  return { storeDir, storeFile };
}

function ensureStoreDir(storeDir: string) {
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
}

function readStore(): Record<string, { refreshToken: string }> {
  try {
    const { storeFile } = resolveStorePaths();
    if (!fs.existsSync(storeFile)) {
      return {};
    }
    const contents = fs.readFileSync(storeFile, 'utf-8');
    return JSON.parse(contents);
  } catch (error) {
    console.error('[googleTokenStore] Failed to read store', error);
    return {};
  }
}

function writeStore(data: Record<string, { refreshToken: string }>) {
  try {
    const { storeDir, storeFile } = resolveStorePaths();
    ensureStoreDir(storeDir);
    fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[googleTokenStore] Failed to write store', error);
  }
}

export async function saveRefreshToken(account: string, refreshToken: string) {
  const store = readStore();
  store[account] = { refreshToken };
  writeStore(store);
}

export async function getRefreshToken(account: string) {
  const store = readStore();
  return store[account]?.refreshToken ?? null;
}

export async function deleteRefreshToken(account: string) {
  const store = readStore();
  if (store[account]) {
    delete store[account];
    writeStore(store);
  }
}
