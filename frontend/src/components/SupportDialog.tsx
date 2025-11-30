import { Bug, FolderOpen, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SupportDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start">
          <HelpCircle className="h-4 w-4 mr-2" />
          Support
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Get Help</DialogTitle>
          <DialogDescription>
            Having issues? Generate a diagnostic report to help troubleshoot problems.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Button
              variant="default"
              onClick={() => window.electronAPI?.reportIssue()}
              className="w-full"
              disabled={!window.electronAPI}
            >
              <Bug className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
            <p className="text-xs text-muted-foreground">
              Generates a diagnostic report with system info and logs, then opens your email
              client. No data is sent automatically - you control what gets shared.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => window.electronAPI?.openLogsFolder()}
              className="w-full"
              disabled={!window.electronAPI}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Open Logs Folder
            </Button>
            <p className="text-xs text-muted-foreground">
              View application logs directly for debugging.
            </p>
          </div>

          {!window.electronAPI && (
            <p className="text-xs text-amber-500">
              These features are only available in the desktop app.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
