export {};

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      // Future IPC methods will be added here
    };
  }
}

