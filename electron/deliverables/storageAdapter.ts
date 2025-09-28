import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { mainLog } from '../logger';

const DEFAULT_STORAGE_DIR = process.env.DELIVERABLES_V2_STORAGE_DIR || path.join(process.cwd(), '.deliverables', 'objects');

function resolveStorageDir(): string {
  if (process.env.DELIVERABLES_V2_STORAGE_DIR) {
    return process.env.DELIVERABLES_V2_STORAGE_DIR;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = eval('require')('electron') as typeof import('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'deliverables-v2', 'objects');
    }
  } catch {
    // ignore, fall back
  }
  return DEFAULT_STORAGE_DIR;
}

export type PutObjectResult = {
  storageKey: string;
  bytes: number;
  sha256: string;
};

export class LocalObjectStorageAdapter {
  private baseDir: string;
  private signedUrlCache: Map<string, { key: string; expiresAt: number }> = new Map();

  constructor(baseDir = resolveStorageDir()) {
    this.baseDir = baseDir;
  }

  private async ensureDir(target: string) {
    await fs.mkdir(target, { recursive: true });
  }

  private resolveKeyPath(storageKey: string) {
    return path.join(this.baseDir, storageKey);
  }

  private async writeFile(dest: string, payload: Buffer | Uint8Array) {
    await this.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, payload);
  }

  async putObject(payload: Buffer | Uint8Array, extension: string): Promise<PutObjectResult> {
    const sha = createHash('sha256').update(payload).digest('hex');
    const storageKey = path.join(sha.slice(0, 2), `${sha}.${extension.replace(/^\./, '')}`);
    await this.writeFile(this.resolveKeyPath(storageKey), Buffer.from(payload));
    mainLog('Stored object', storageKey);
    return { storageKey, bytes: payload.length, sha256: sha };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const resolved = this.resolveKeyPath(storageKey);
    return fs.readFile(resolved);
  }

  createSignedUrl(storageKey: string, ttlMs = 5 * 60 * 1000): string {
    const token = randomUUID();
    const expiresAt = Date.now() + ttlMs;
    this.signedUrlCache.set(token, { key: storageKey, expiresAt });
    return `local-signed://${token}`;
  }

  async resolveSignedUrl(url: string): Promise<Buffer | null> {
    if (!url.startsWith('local-signed://')) {
      return null;
    }
    const token = url.replace('local-signed://', '');
    const entry = this.signedUrlCache.get(token);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.signedUrlCache.delete(token);
      return null;
    }
    return this.getObject(entry.key);
  }
}

export function detectMimeByMagic(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }
  return null;
}

export function extensionFromMime(mime: string): string {
  if (mime === 'application/pdf') {
    return 'pdf';
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  }
  return 'bin';
}

export function computeSha256(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}
