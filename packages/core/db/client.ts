import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

let instance: Database.Database | null = null;

function ensureDirectory(filePath: string) {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
}

export function getClient(filePath = path.join(process.cwd(), "artifacts", "context.sqlite")) {
  if (instance) {
    return instance;
  }

  if (filePath !== ":memory:") {
    ensureDirectory(filePath);
  }

  instance = new Database(filePath);
  instance.pragma("journal_mode = WAL");
  return instance;
}

export function closeClient() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
