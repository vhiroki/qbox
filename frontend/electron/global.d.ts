export {};

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  releaseName?: string;
}

interface ProgressInfo {
  total: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateStatus {
  state: UpdateState;
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
  lastChecked?: string;
}

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      reportIssue: () => Promise<void>;
      openLogsFolder: () => Promise<void>;
      updates?: {
        checkForUpdates: () => Promise<void>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
        dismissUpdate: () => Promise<void>;
        getUpdateState: () => Promise<UpdateStatus>;
        onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
        onDownloadProgress: (callback: (progress: ProgressInfo) => void) => void;
        onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
        onUpdateError: (callback: (error: Error) => void) => void;
        onCheckingForUpdate: (callback: () => void) => void;
        onUpdateNotAvailable: (callback: () => void) => void;
        removeUpdateListeners: () => void;
      };
    };
  }

  // Electron Forge Vite plugin injects these variables
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}

