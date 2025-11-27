import { app, BrowserWindow, dialog, Notification } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { config } from './config';
// @ts-expect-error - electron-squirrel-startup doesn't have type definitions but will be bundled
import squirrelStartup from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (squirrelStartup) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let updateCheckInterval: NodeJS.Timeout | null = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Start the Python backend process
 */
async function startBackend(): Promise<void> {
  if (config.isDevelopment) {
    console.log('Development mode: Expecting backend to be started separately');
    return;
  }

  const backendPath = config.getBackendExecutablePath();
  
  if (!backendPath) {
    throw new Error('Backend executable path not configured');
  }

  console.log('Starting backend process:', backendPath);

  return new Promise((resolve, reject) => {
    try {
      backendProcess = spawn(backendPath, [], {
        env: {
          ...process.env,
          PORT: config.backend.port.toString(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          console.log('Backend:', data.toString());
        });
      }

      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          console.error('Backend error:', data.toString());
        });
      }

      backendProcess.on('error', (error) => {
        console.error('Failed to start backend:', error);
        reject(error);
      });

      backendProcess.on('exit', (code, signal) => {
        console.log(`Backend process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
          reject(new Error(`Backend exited with code ${code}`));
        }
      });

      // Wait for backend to be healthy
      waitForBackendHealth()
        .then(() => {
          console.log('Backend is healthy');
          resolve();
        })
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Wait for backend to respond to health checks
 */
async function waitForBackendHealth(): Promise<void> {
  const startTime = Date.now();
  const healthUrl = `http://${config.backend.host}:${config.backend.port}${config.backend.healthCheckEndpoint}`;
  const apiUrl = `http://${config.backend.host}:${config.backend.port}/api/queries/`;

  // First, wait for basic health check
  while (Date.now() - startTime < config.backend.healthCheckTimeout) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('Backend health check passed, verifying API readiness...');
        break;
      }
    } catch (error) {
      // Backend not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, config.backend.healthCheckInterval));
  }

  // Then verify the API is actually ready by testing a real endpoint
  // This ensures all services (database, etc.) are initialized
  let apiReady = false;
  const apiCheckStart = Date.now();
  while (Date.now() - apiCheckStart < 10000) { // 10 second timeout for API check
    try {
      const response = await fetch(apiUrl);
      if (response.ok || response.status === 200) {
        apiReady = true;
        console.log('Backend API is ready');
        break;
      }
    } catch (error) {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!apiReady) {
    console.warn('Backend API check timed out, proceeding anyway...');
  }
}

/**
 * Stop the Python backend process
 */
function stopBackend(): void {
  if (backendProcess) {
    console.log('Stopping backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}

/**
 * Setup auto-updater
 */
function setupAutoUpdater(): void {
  if (!config.autoUpdate.enabled || config.isDevelopment) {
    console.log('Auto-update disabled (development mode or disabled in config)');
    return;
  }

  // Configure auto-updater
  if (config.autoUpdate.serverUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: config.autoUpdate.serverUrl,
    });
  }

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    
    // Show notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Update Available',
        body: `A new version of QBox (${info.version}) is available. It will be downloaded in the background.`,
      });
      notification.show();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    
    // Show dialog asking user to restart
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart QBox to apply the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result === 0) {
      // User chose to restart
      autoUpdater.quitAndInstall();
    }
  });

  // Check for updates now
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Failed to check for updates:', err);
  });

  // Setup periodic update checks
  if (config.autoUpdate.checkInterval > 0) {
    updateCheckInterval = setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Failed to check for updates:', err);
      });
    }, config.autoUpdate.checkInterval);
  }
}

/**
 * Cleanup auto-updater
 */
function cleanupAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

/**
 * Create the main application window with loading screen
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a', // Dark theme background
    show: false, // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Load the loading screen
 */
function loadLoadingScreen(): void {
  if (!mainWindow) return;
  
  // Load the loading screen from the renderer directory
  // In production, public files are copied to the renderer output
  const loadingPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/loading.html`);
  mainWindow.loadFile(loadingPath);
}

/**
 * Load the main application
 */
function loadMainApp(): void {
  if (!mainWindow) return;
  
  // Note: When using Electron Forge with Vite plugin, we need to use special variables
  // MAIN_WINDOW_VITE_DEV_SERVER_URL is injected by the plugin in development
  // MAIN_WINDOW_VITE_NAME is used to resolve the built files in production
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development, load from Vite dev server
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    // The plugin handles the path resolution automatically
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  try {
    // Create window immediately and show loading screen
    createWindow();
    
    // In production, show loading screen while backend starts
    if (!config.isDevelopment) {
      loadLoadingScreen();
    }
    
    // Start backend (this waits for it to be ready)
    await startBackend();
    
    // Backend is ready, load the main app
    loadMainApp();
    
    // Setup auto-updater after app is loaded
    setupAutoUpdater();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Show error dialog
    dialog.showErrorBox(
      'Failed to Start QBox',
      `Could not start the application: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support.`
    );
    
    // Quit the app
    app.quit();
  }
}

// App lifecycle events
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    // Backend should already be running, so load the main app directly
    loadMainApp();
  }
});

app.on('before-quit', () => {
  cleanupAutoUpdater();
  stopBackend();
});

app.on('will-quit', () => {
  cleanupAutoUpdater();
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
});

