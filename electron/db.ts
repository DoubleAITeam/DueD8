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
  db.pragma('foreign_keys = ON');
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

    CREATE TABLE IF NOT EXISTS flashcard_deck (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('class','general')),
      class_id TEXT,
      tags TEXT NOT NULL,
      card_order TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_flashcard_deck_scope ON flashcard_deck(scope);

    CREATE TABLE IF NOT EXISTS flashcard_card (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      tags TEXT NOT NULL,
      source_ids TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      studied_count INTEGER NOT NULL DEFAULT 0,
      last_studied_at TEXT,
      FOREIGN KEY(deck_id) REFERENCES flashcard_deck(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_flashcard_card_deck ON flashcard_card(deck_id);
    CREATE INDEX IF NOT EXISTS idx_flashcard_card_updated ON flashcard_card(updated_at);

    CREATE TABLE IF NOT EXISTS flashcard_source_asset (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('paste','upload')),
      filename TEXT,
      mime_type TEXT,
      text_extract TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_quota (
      user_id TEXT PRIMARY KEY,
      used INTEGER NOT NULL DEFAULT 0,
      quota_limit INTEGER NOT NULL DEFAULT 50,
      reset_at TEXT
    );
  `);
}
