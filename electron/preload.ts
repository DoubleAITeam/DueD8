// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] loaded');

contextBridge.exposeInMainWorld('dued8', {
  ping: () => ipcRenderer.invoke('ping'),

  canvas: {
    setToken: (token: string) => ipcRenderer.invoke('canvas:setToken', token),
    getToken: () => ipcRenderer.invoke('canvas:getToken'),
    clearToken: () => ipcRenderer.invoke('canvas:clearToken'),
    testToken: () => ipcRenderer.invoke('canvas:testToken'),
    get: (payload: { path: string; query?: Record<string, string | number | boolean> }) =>
      ipcRenderer.invoke('canvas:get', payload)
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

  files: {
    processAssignmentFiles: (payload: {
      assignmentId: number;
      courseId: number;
      files: Array<{ path: string; name: string }>;
    }) => ipcRenderer.invoke('files:processAssignment', payload),
    getAssignmentDetails: (assignmentId: number) => ipcRenderer.invoke('files:getAssignmentDetails', assignmentId)
  }
});