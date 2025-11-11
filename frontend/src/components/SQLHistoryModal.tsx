import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { SQLHistoryItem } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, History, RotateCcw } from "lucide-react";

interface SQLHistoryModalProps {
  queryId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (sqlText: string) => void;
}

export default function SQLHistoryModal({
  queryId,
  isOpen,
  onClose,
  onRestore,
}: SQLHistoryModalProps) {
  const [versions, setVersions] = useState<SQLHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, queryId]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSQLHistory(queryId);
      setVersions(data.versions);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load SQL history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (historyId: number, sqlText: string) => {
    setRestoringId(historyId);
    setError(null);
    try {
      await api.restoreSQLFromHistory(queryId, { history_id: historyId });
      onRestore(sqlText);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to restore SQL version");
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleString();
  };

  const truncateSQL = (sql: string, maxLength: number = 150) => {
    if (sql.length <= maxLength) return sql;
    return sql.substring(0, maxLength) + "...";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              SQL History
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of your SQL query. Up to 50
              versions are stored.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex-1 min-h-0 px-6 py-4">
          <ScrollArea className="h-full pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading history...
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p>No history yet</p>
                <p className="text-sm">
                  SQL versions will appear here as you edit your query
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            Version {versions.length - index}
                          </span>
                          {index === 0 && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(version.created_at)}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleRestore(version.id, version.sql_text)}
                        disabled={restoringId === version.id || index === 0}
                        size="sm"
                        variant="outline"
                      >
                        {restoringId === version.id ? (
                          <>Restoring...</>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-muted/50 rounded p-3 mt-2">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                        {truncateSQL(version.sql_text)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

