// src/main/ipc.ts
import fs from 'node:fs';
import path from 'node:path';
import { app, ipcMain } from 'electron';
const fetch = globalThis.fetch;
import { z } from 'zod';
import { getDb } from './db';
ipcMain.handle('ping', () => 'pong');


const SERVICE = 'DueD8'; // keychain service name

const TOKEN_FILE = path.join(app.getPath('userData'), 'token.json');

function saveTokenToFile(token: string) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }), 'utf-8');
}

function readTokenFromFile(): string | null {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    return typeof data.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}

ipcMain.handle('canvas.testToken', async () => {
  const token = readTokenFromFile();
  if (!token) throw new Error('No token saved');

  const hosts = ['https://canvas.gmu.edu', 'https://gmu.instructure.com'];
  const errors: Array<{ host: string; status?: number; statusText?: string }> = [];

  for (const host of hosts) {
    try {
      const resp = await fetch(`${host}/api/v1/users/self`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        redirect: 'manual'
      } as RequestInit);
      if (resp.ok) {
        const profile = await resp.json();
        return { host, profile };
      }
      errors.push({ host, status: resp.status, statusText: resp.statusText });
    } catch (e) {
      errors.push({ host, statusText: (e as Error).message });
    }
  }

  throw new Error(
    `Canvas error: all hosts failed: ${errors.map(e => `${e.host} -> ${e.status ?? ''} ${e.statusText ?? ''}` ).join(' | ')}`
  );
});

// Schemas
const StudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  county: z.enum(['Fairfax','Sci-Tech'])
});

ipcMain.handle('token.save', async (_e, token: string) => {
  if (!token || typeof token !== 'string') throw new Error('Invalid token');
  const cleaned = token.trim();
  if (!cleaned) throw new Error('Empty token');
  saveTokenToFile(cleaned);
  return true;
});

ipcMain.handle('token.get', async () => {
  return readTokenFromFile();
});

ipcMain.handle('token.info', async () => {
  const t = readTokenFromFile();
  return t ? { length: t.length, startsWith: t.slice(0, 6) } : null;
});

ipcMain.handle('students.add', (_e, payload) => {
  const s = StudentSchema.parse(payload);
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO student (first_name,last_name,county) VALUES (?,?,?)`
  );
  const info = stmt.run(s.first_name, s.last_name, s.county);
  return { id: Number(info.lastInsertRowid) };
});

ipcMain.handle('students.list', () => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, first_name, last_name, county, created_at FROM student ORDER BY last_name, first_name`
  ).all();
  return rows;
});

ipcMain.handle('events.upsert', (_e, name: string, event_date: string) => {
  if (!name) throw new Error('name required');
  if (!event_date) throw new Error('event_date required');
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM event WHERE name=? AND event_date=?`
  ).get(name, event_date) as { id: number } | undefined;
  if (existing && typeof existing.id !== 'undefined') {
    return { id: Number(existing.id), updated: false };
  }
  const info = db.prepare(`INSERT INTO event (name, event_date) VALUES (?,?)`).run(name, event_date);
  return { id: Number(info.lastInsertRowid), updated: false };
});

ipcMain.handle('attendance.set', (_e, student_id: number, event_id: number, status: 'Present'|'Absent'|'NO AMP') => {
  const db = getDb();
  db.prepare(`
    INSERT INTO attendance (student_id, event_id, status)
    VALUES (?,?,?)
    ON CONFLICT(student_id, event_id) DO UPDATE SET status=excluded.status
  `).run(student_id, event_id, status);
  return true;
});