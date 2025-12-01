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
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span>
            <span className="font-medium">Update available:</span>{' '}
            <span className="text-muted-foreground">QBox {updateInfo?.version} is ready to download</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={downloadUpdate}>
            Download Now
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissUpdate}>
            Later
          </Button>
        </div>
      </div>
    );
  }

  // Downloading in progress
  if (state === 'downloading' && downloadProgress) {
    const progressPercent = Math.round(downloadProgress.percent);
    const speedMBps = (downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(1);

    return (
      <div className="px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4 text-muted-foreground animate-pulse" />
            <span className="font-medium">Downloading update...</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {progressPercent}% • {speedMBps} MB/s
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Downloaded - ready to install
  if (state === 'downloaded') {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <span>
            <span className="font-medium">Update ready:</span>{' '}
            <span className="text-muted-foreground">Restart to update to version {updateInfo?.version}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={installUpdate}>
            Restart Now
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismissUpdate}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
