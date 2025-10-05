import type { DeliverableLogEntry } from './types';

const MAX_LOG_ENTRIES = 200;
const logs: DeliverableLogEntry[] = [];

export function appendLog(entry: Omit<DeliverableLogEntry, 'timestamp'> & { timestamp?: number }): void {
  const record: DeliverableLogEntry = {
    timestamp: entry.timestamp ?? Date.now(),
    level: entry.level,
    scope: entry.scope,
    message: entry.message,
    data: entry.data
  };
  logs.push(record);
  while (logs.length > MAX_LOG_ENTRIES) {
    logs.shift();
  }
}

export function getLogs(): DeliverableLogEntry[] {
  return [...logs];
}

export function clearLogs(): void {
  logs.splice(0, logs.length);
}

