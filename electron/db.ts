// src/main/db.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database;

export function getDb() {
  if (db) return db;
  const userData = app.getPath('userData');
  const dbDir = path.join(userData, 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'dued8.sqlite');
  db = new Database(dbPath);
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS student (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      county     TEXT CHECK(county IN ('Fairfax','Sci-Tech')) NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      student_id INTEGER NOT NULL,
      event_id   INTEGER NOT NULL,
      status     TEXT CHECK(status IN ('Present','Absent','NO AMP')) NOT NULL,
      PRIMARY KEY (student_id, event_id),
      FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES event(id)   ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      assignment_id INTEGER,
      tokens_used INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS token_usage_assignment_idx ON token_usage(user_email, assignment_id);
    CREATE INDEX IF NOT EXISTS token_usage_window_idx ON token_usage(user_email, created_at);

    CREATE TABLE IF NOT EXISTS google_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      connected INTEGER NOT NULL DEFAULT 0,
      connected_at TEXT,
      account_email TEXT
    );
    INSERT OR IGNORE INTO google_connection (id, connected) VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS assignment_google_doc (
      assignment_id INTEGER PRIMARY KEY,
      document_id TEXT NOT NULL,
      document_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}