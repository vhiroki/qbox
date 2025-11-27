export {};

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      // Future IPC methods will be added here
    };
  }
  
  // Electron Forge Vite plugin injects these variables
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}

