import { X, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateStore } from '@/stores';

export default function UpdateBanner() {
  const {
    state,
    updateInfo,
    downloadProgress,
    isUpdateBannerVisible,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  } = useUpdateStore();

  if (!isUpdateBannerVisible || !window.electronAPI?.updates) {
    return null;
  }

  // Update available - not yet downloading
  if (state === 'available') {
    return (
      <div className="bg-blue-600 dark:bg-blue-700 border-b border-blue-700 dark:border-blue-800">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Download className="h-4 w-4 text-blue-100 shrink-0" />
              <div className="text-sm text-blue-100 truncate">
                <span className="font-medium">Update available:</span> QBox {updateInfo?.version} is ready to download
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadUpdate}
                className="h-7 text-blue-100 hover:bg-blue-800 hover:text-white"
              >
                Download Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissUpdate}
                className="h-7 text-blue-100 hover:bg-blue-800 hover:text-white"
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Downloading in progress
  if (state === 'downloading' && downloadProgress) {
    const progressPercent = Math.round(downloadProgress.percent);
    const speedMBps = (downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(1);

    return (
      <div className="bg-blue-600 dark:bg-blue-700 border-b border-blue-700 dark:border-blue-800">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-100 animate-pulse" />
                  <span className="text-sm text-blue-100 font-medium">
                    Downloading update...
                  </span>
                </div>
                <span className="text-xs text-blue-200">
                  {progressPercent}% • {speedMBps} MB/s
                </span>
              </div>
              <div className="w-full bg-blue-800 rounded-full h-1.5">
                <div
                  className="bg-blue-300 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Downloaded - ready to install
  if (state === 'downloaded') {
    return (
      <div className="bg-green-600 dark:bg-green-700 border-b border-green-700 dark:border-green-800">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <RefreshCw className="h-4 w-4 text-green-100 shrink-0" />
              <div className="text-sm text-green-100 truncate">
                <span className="font-medium">Update ready:</span> Restart QBox to update to version {updateInfo?.version}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={installUpdate}
                className="h-7 text-green-100 hover:bg-green-800 hover:text-white font-medium"
              >
                Restart Now
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissUpdate}
                className="h-7 w-7 text-green-100 hover:bg-green-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
