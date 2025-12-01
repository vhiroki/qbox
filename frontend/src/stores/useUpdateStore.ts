import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UpdateState, UpdateInfo, ProgressInfo, UpdateStatus } from '../types';
import { toast } from 'sonner';

interface UpdateStoreState {
  // Update status
  state: UpdateState;
  updateInfo?: UpdateInfo;
  downloadProgress?: ProgressInfo;
  error?: string;
  lastChecked?: string;

  // UI state
  isUpdateBannerVisible: boolean;
  isCheckingManually: boolean;

  // Actions
  setUpdateState: (state: UpdateState) => void;
  setUpdateInfo: (info: UpdateInfo) => void;
  setDownloadProgress: (progress: ProgressInfo) => void;
  setError: (error: string) => void;
  setLastChecked: (timestamp: string) => void;

  showUpdateBanner: () => void;
  hideUpdateBanner: () => void;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => Promise<void>;

  // Initialize listeners
  initializeListeners: () => void;
  cleanupListeners: () => void;
}

export const useUpdateStore = create<UpdateStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      state: 'idle',
      updateInfo: undefined,
      downloadProgress: undefined,
      error: undefined,
      lastChecked: undefined,
      isUpdateBannerVisible: false,
      isCheckingManually: false,

      // State setters
      setUpdateState: (newState) => set({ state: newState }),
      setUpdateInfo: (info) => set({ updateInfo: info }),
      setDownloadProgress: (progress) => set({ downloadProgress: progress }),
      setError: (error) => set({ error }),
      setLastChecked: (timestamp) => set({ lastChecked: timestamp }),

      showUpdateBanner: () => set({ isUpdateBannerVisible: true }),
      hideUpdateBanner: () => set({ isUpdateBannerVisible: false }),

      // Actions
      checkForUpdates: async () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;

        set({ isCheckingManually: true, error: undefined });
        try {
          await electronAPI.updates.checkForUpdates();
          set({ lastChecked: new Date().toISOString() });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to check for updates' });
        } finally {
          set({ isCheckingManually: false });
        }
      },

      downloadUpdate: async () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;

        try {
          await electronAPI.updates.downloadUpdate();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to download update' });
        }
      },

      installUpdate: async () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;

        try {
          await electronAPI.updates.installUpdate();
          // App will restart, no need to update state
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to install update' });
        }
      },

      dismissUpdate: async () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;

        try {
          await electronAPI.updates.dismissUpdate();
          set({ isUpdateBannerVisible: false });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to dismiss update' });
        }
      },

      // Initialize event listeners
      initializeListeners: () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;

        electronAPI.updates.onCheckingForUpdate(() => {
          set({ state: 'checking', error: undefined });
        });

        electronAPI.updates.onUpdateAvailable((info) => {
          set({
            state: 'available',
            updateInfo: info,
            isUpdateBannerVisible: true,
          });
        });

        electronAPI.updates.onDownloadProgress((progress) => {
          set({
            state: 'downloading',
            downloadProgress: progress,
          });
        });

        electronAPI.updates.onUpdateDownloaded((info) => {
          set({
            state: 'downloaded',
            updateInfo: info,
            isUpdateBannerVisible: true,
          });
        });

        electronAPI.updates.onUpdateNotAvailable(() => {
          const { isCheckingManually } = get();
          set({
            state: 'idle',
            lastChecked: new Date().toISOString(),
          });

          // Show toast if user manually checked for updates
          if (isCheckingManually) {
            toast.info('You have the latest version');
          }
        });

        electronAPI.updates.onUpdateError((error) => {
          set({
            state: 'error',
            error: error.message,
            isUpdateBannerVisible: false,
          });
          // Truncate long error messages for the toast
          const maxLength = 100;
          const message = error.message.length > maxLength
            ? `${error.message.substring(0, maxLength)}...`
            : error.message;
          toast.error(`Update failed: ${message}`);
        });

        // Listen for manual check request from menu
        electronAPI.updates.onManualCheckRequested(() => {
          // Call checkForUpdates when menu item is clicked
          get().checkForUpdates();
        });
      },

      cleanupListeners: () => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.updates) return;
        electronAPI.updates.removeUpdateListeners();
      },
    }),
    { name: 'UpdateStore' }
  )
);
