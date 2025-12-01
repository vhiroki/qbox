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

  // Auto-update methods
  updates: {
    // Manual check for updates
    checkForUpdates: () => ipcRenderer.invoke('updates:check'),

    // Download update (when available)
    downloadUpdate: () => ipcRenderer.invoke('updates:download'),

    // Install update and restart
    installUpdate: () => ipcRenderer.invoke('updates:install'),

    // Dismiss update notification
    dismissUpdate: () => ipcRenderer.invoke('updates:dismiss'),

    // Get current update state
    getUpdateState: () => ipcRenderer.invoke('updates:getState'),

    // Event listeners
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('updates:available', (_, info) => callback(info));
    },

    onDownloadProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('updates:progress', (_, progress) => callback(progress));
    },

    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('updates:downloaded', (_, info) => callback(info));
    },

    onUpdateError: (callback: (error: any) => void) => {
      ipcRenderer.on('updates:error', (_, error) => callback(error));
    },

    onCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('updates:checking', () => callback());
    },

    onUpdateNotAvailable: (callback: () => void) => {
      ipcRenderer.on('updates:not-available', () => callback());
    },

    onManualCheckRequested: (callback: () => void) => {
      ipcRenderer.on('updates:manual-check-requested', () => callback());
    },

    // Cleanup listeners
    removeUpdateListeners: () => {
      ipcRenderer.removeAllListeners('updates:available');
      ipcRenderer.removeAllListeners('updates:progress');
      ipcRenderer.removeAllListeners('updates:downloaded');
      ipcRenderer.removeAllListeners('updates:error');
      ipcRenderer.removeAllListeners('updates:checking');
      ipcRenderer.removeAllListeners('updates:not-available');
      ipcRenderer.removeAllListeners('updates:manual-check-requested');
    },
  },
});

// Type declaration for TypeScript (will be in a separate .d.ts file)
export {};

