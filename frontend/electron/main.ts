import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { config } from './config';
import { logger } from './logger';
import { reportIssue } from './diagnostics';
// @ts-expect-error - electron-squirrel-startup doesn't have type definitions but will be bundled
import squirrelStartup from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (squirrelStartup) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let updateCheckInterval: NodeJS.Timeout | null = null;

// Update state management
interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  info?: {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
    releaseName?: string;
  };
  progress?: {
    total: number;
    transferred: number;
    percent: number;
    bytesPerSecond: number;
  };
  error?: string;
  lastChecked?: string;
}

let updateState: UpdateStatus = { state: 'idle' };

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
    logger.info('Development mode: Expecting backend to be started separately');
    return;
  }

  const backendPath = config.getBackendExecutablePath();

  if (!backendPath) {
    throw new Error('Backend executable path not configured');
  }

  logger.info(`Starting backend process: ${backendPath}`);

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
          logger.backend(data.toString());
        });
      }

      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          logger.backend(data.toString(), true);
        });
      }

      backendProcess.on('error', (error) => {
        logger.error('Failed to start backend', error as Error);
        reject(error);
      });

      backendProcess.on('exit', (code, signal) => {
        logger.info(`Backend process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
          reject(new Error(`Backend exited with code ${code}`));
        }
      });

      // Wait for backend to be healthy
      waitForBackendHealth()
        .then(() => {
          logger.info('Backend is healthy');
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
        logger.info('Backend health check passed, verifying API readiness...');
        break;
      }
    } catch {
      // Backend not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, config.backend.healthCheckInterval));
  }

  // Then verify the API is actually ready by testing a real endpoint
  // This ensures all services (database, etc.) are initialized
  let apiReady = false;
  const apiCheckStart = Date.now();
  while (Date.now() - apiCheckStart < 10000) {
    // 10 second timeout for API check
    try {
      const response = await fetch(apiUrl);
      if (response.ok || response.status === 200) {
        apiReady = true;
        logger.info('Backend API is ready');
        break;
      }
    } catch {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!apiReady) {
    logger.warn('Backend API check timed out, proceeding anyway...');
  }
}

/**
 * Stop the Python backend process
 */
function stopBackend(): void {
  if (backendProcess) {
    logger.info('Stopping backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}

/**
 * Send update events to renderer process
 */
function sendToRenderer(channel: string, data?: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Setup auto-updater
 */
function setupAutoUpdater(): void {
  if (!config.autoUpdate.enabled || config.isDevelopment) {
    logger.info('Auto-update disabled (development mode or disabled in config)');
    return;
  }

  // Configure auto-updater
  // Priority: GitHub > Generic server URL
  const { github, serverUrl } = config.autoUpdate;

  if (github.owner && github.repo) {
    // Use GitHub releases
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: github.owner,
      repo: github.repo,
    });
    logger.info(`Auto-updater configured for GitHub: ${github.owner}/${github.repo}`);
  } else if (serverUrl) {
    // Fall back to generic server
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: serverUrl,
    });
    logger.info(`Auto-updater configured for generic server: ${serverUrl}`);
  } else {
    logger.info(
      'Auto-updater not configured: set GITHUB_OWNER/GITHUB_REPO or UPDATE_SERVER_URL'
    );
    return;
  }

  // User controls when to download updates
  autoUpdater.autoDownload = false;
  // Auto-install on app quit if update is downloaded
  autoUpdater.autoInstallOnAppQuit = true;

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
    updateState = { state: 'checking' };
    sendToRenderer('updates:checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: ${info.version}`);
    updateState = {
      state: 'available',
      info: {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName,
      },
      lastChecked: new Date().toISOString(),
    };
    sendToRenderer('updates:available', updateState.info);
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info(`Update not available: current version ${info.version}`);
    updateState = {
      state: 'idle',
      lastChecked: new Date().toISOString(),
    };
    sendToRenderer('updates:not-available');
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater', err);
    updateState = {
      state: 'error',
      error: err.message,
    };
    sendToRenderer('updates:error', { message: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info(
      `Download progress: ${progressObj.percent.toFixed(1)}% (${(progressObj.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`
    );
    updateState = {
      ...updateState,
      state: 'downloading',
      progress: {
        total: progressObj.total,
        transferred: progressObj.transferred,
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
      },
    };
    sendToRenderer('updates:progress', updateState.progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`Update downloaded: ${info.version}`);
    updateState = {
      ...updateState,
      state: 'downloaded',
      info: {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName,
      },
    };
    sendToRenderer('updates:downloaded', updateState.info);
  });

  // Initial check on startup (delayed by 10 seconds to let app fully load)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('Failed initial update check', err);
    });
  }, 10000);

  // Periodic checks (6 hours by default)
  if (config.autoUpdate.checkInterval > 0) {
    updateCheckInterval = setInterval(() => {
      // Only auto-check if we're idle (not already checking/downloading)
      if (updateState.state === 'idle') {
        autoUpdater.checkForUpdates().catch((err) => {
          logger.error('Failed periodic update check', err);
        });
      }
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
 * Setup IPC handlers for renderer process communication
 */
function setupIpcHandlers(): void {
  // Handle report issue request from renderer
  ipcMain.handle('report-issue', async () => {
    await reportIssue();
  });

  // Handle open logs folder request from renderer
  ipcMain.handle('open-logs-folder', async () => {
    await shell.openPath(logger.getLogDir());
  });

  // Update IPC handlers
  ipcMain.handle('updates:check', async () => {
    if (!config.autoUpdate.enabled || config.isDevelopment) {
      throw new Error('Auto-update is disabled');
    }
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updates:download', async () => {
    if (updateState.state !== 'available') {
      throw new Error('No update available to download');
    }
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updates:install', () => {
    if (updateState.state !== 'downloaded') {
      throw new Error('No update ready to install');
    }
    // false = don't force close, true = restart after install
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updates:dismiss', () => {
    // Reset to idle if in 'available' state (user chose "Later")
    if (updateState.state === 'available') {
      updateState = { ...updateState, state: 'idle' };
    }
  });

  ipcMain.handle('updates:getState', () => {
    return updateState;
  });
}

/**
 * Setup application menu with Help > Report Issue
 */
function setupMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (mainWindow) {
              // Trigger manual update check in renderer
              mainWindow.webContents.send('updates:manual-check-requested');
            }
          },
          enabled: config.autoUpdate.enabled && !config.isDevelopment,
        },
        { type: 'separator' },
        {
          label: 'Report Issue...',
          click: () => {
            reportIssue();
          },
        },
        { type: 'separator' },
        {
          label: 'View Logs Folder',
          click: () => {
            shell.openPath(logger.getLogDir());
          },
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/vhiroki/qbox');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  // Initialize logger first
  logger.init();

  // Setup IPC handlers and application menu
  setupIpcHandlers();
  setupMenu();

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
    logger.error('Failed to initialize app', error as Error);

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
  logger.info('Application quitting...');
  cleanupAutoUpdater();
  stopBackend();
});

app.on('will-quit', () => {
  cleanupAutoUpdater();
  stopBackend();
  logger.close();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
});

