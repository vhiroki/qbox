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
    // Note: The backend/dist directory is copied as extraResource in forge.config.ts
    const resourcesPath = process.resourcesPath;
    const platform = process.platform;
    
    let execName = 'qbox-backend';
    if (platform === 'win32') {
      execName += '.exe';
    }
    
    return path.join(resourcesPath, 'dist', execName);
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
    // GitHub repository for updates (owner/repo format)
    // Configure these with your actual GitHub username/org and repo name
    // Example: { owner: 'vhiroki', repo: 'qbox' }
    github: {
      owner: 'vhiroki',
      repo: 'qbox',
    },
    // Alternative: Generic server URL (used if github is not configured)
    // Example: 'https://your-server.com/releases'
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

