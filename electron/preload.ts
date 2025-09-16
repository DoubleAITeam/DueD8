// preload.ts
import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
  getVersion: () => ipcRenderer.invoke("app:getVersion")
});