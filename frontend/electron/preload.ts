import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  
  // Future IPC methods can be added here
  // Example: onUpdateAvailable: (callback: () => void) => ipcRenderer.on('update-available', callback),
  // Example: quitAndInstall: () => ipcRenderer.send('quit-and-install'),
});

// Type declaration for TypeScript (will be in a separate .d.ts file)
export {};

