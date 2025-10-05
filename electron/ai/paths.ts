import os from 'node:os';
import path from 'node:path';
import type { App } from 'electron';

const electronCandidate = require('electron') as unknown;
const electronApp: App | null =
  electronCandidate &&
  typeof electronCandidate === 'object' &&
  electronCandidate !== null &&
  'app' in electronCandidate &&
  typeof (electronCandidate as { app?: App }).app?.getPath === 'function'
    ? ((electronCandidate as { app: App }).app)
    : null;

export function resolveUserDataRoot(): string {
  const override = process.env.DELIVERABLES_USER_DATA;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  if (electronApp) {
    return electronApp.getPath('userData');
  }
  const home = process.env.HOME || os.homedir() || process.cwd();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'DueD8');
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(base, 'DueD8');
  }
  return path.join(home, '.config', 'DueD8');
}

export function getElectronApp(): App | null {
  return electronApp;
}

export function setUserDataRoot(root: string): void {
  if (electronApp && typeof electronApp.setPath === 'function') {
    electronApp.setPath('userData', path.resolve(root));
  } else {
    process.env.DELIVERABLES_USER_DATA = path.resolve(root);
  }
}
