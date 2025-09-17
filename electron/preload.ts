// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] loaded');

contextBridge.exposeInMainWorld('dued8', {
  ping: () => ipcRenderer.invoke('ping'),

  token: {
    save: (token: string) => ipcRenderer.invoke('token.save', token),
    get: () => ipcRenderer.invoke('token.get'),
    info: () => ipcRenderer.invoke('token.info')
  },

  students: {
    add: (s: { first_name: string; last_name: string; county: 'Fairfax'|'Sci-Tech' }) =>
      ipcRenderer.invoke('students.add', s),
    list: () => ipcRenderer.invoke('students.list')
  },

  events: {
    upsert: (name: string, event_date: string) =>
      ipcRenderer.invoke('events.upsert', name, event_date)
  },

  attendance: {
    set: (student_id: number, event_id: number, status: 'Present'|'Absent'|'NO AMP') =>
      ipcRenderer.invoke('attendance.set', student_id, event_id, status)
  },
  canvas: {
    testToken: () => ipcRenderer.invoke('canvas.testToken')
  }
});