import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // Report issue - triggers diagnostic report generation and email
  reportIssue: () => ipcRenderer.invoke('report-issue'),

  // Open logs folder
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
});

// Type declaration for TypeScript (will be in a separate .d.ts file)
export {};

