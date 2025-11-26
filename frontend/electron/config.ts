import { app } from 'electron';
import path from 'path';

export const config = {
  // Backend configuration
  backend: {
    port: 8080,
    host: 'localhost',
    healthCheckEndpoint: '/health',
    healthCheckTimeout: 30000, // 30 seconds
    healthCheckInterval: 1000, // 1 second
  },

  // Get backend executable path based on platform and environment
  getBackendExecutablePath(): string {
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // In development, we expect the backend to be started separately via run.sh
      return '';
    }

    // In production, get the path from resources
    const resourcesPath = process.resourcesPath;
    const platform = process.platform;
    
    let execName = 'qbox-backend';
    if (platform === 'win32') {
      execName += '.exe';
    }
    
    return path.join(resourcesPath, 'backend', execName);
  },

  // App data directory
  getAppDataPath(): string {
    const homeDir = app.getPath('home');
    return path.join(homeDir, '.qbox');
  },

  // Auto-update configuration
  autoUpdate: {
    enabled: true,
    checkInterval: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
    // Update server URL - configure this based on your deployment
    // For GitHub releases: https://github.com/owner/repo/releases/latest
    serverUrl: process.env.UPDATE_SERVER_URL || '',
  },

  // Window configuration
  window: {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
  },

  // Development mode detection
  isDevelopment: !app.isPackaged,
};

