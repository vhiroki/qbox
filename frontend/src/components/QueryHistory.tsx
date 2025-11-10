import { useState, useEffect } from "react";
import { Play, Trash2, Clock, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { api } from "../services/api";
import type { QueryHistoryItem } from "../types";

interface QueryHistoryProps {
  workspaceId: string;
  onRerun: (item: QueryHistoryItem) => void;
  refreshTrigger?: number;
}

export default function QueryHistory({
  workspaceId,
  onRerun,
  refreshTrigger = 0,
}: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getQueryHistory(workspaceId, 50, 0);
      setHistory(data.queries);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to load query history"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [workspaceId, refreshTrigger]);

  const handleDelete = async (queryId: string) => {
    try {
      await api.deleteQueryFromHistory(workspaceId, queryId);
      setHistory((prev) => prev.filter((q) => q.id !== queryId));
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to delete query from history"
      );
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearQueryHistory(workspaceId);
      setHistory([]);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to clear query history"
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No query history</h3>
        <p className="text-sm text-muted-foreground">
          Your executed queries will appear here
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {history.length} {history.length === 1 ? "query" : "queries"}
        </h3>
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear query history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all queries from history. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="space-y-3">
        {history.map((item) => (
          <Card key={item.id} className="p-4 hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">{item.prompt}</p>
                {item.explanation && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {item.explanation}
                  </p>
                )}
                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto mb-2">
                  {item.executed_sql || item.generated_sql}
                </pre>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatDate(item.created_at)}</span>
                  {item.row_count !== null && item.row_count !== undefined && (
                    <span>
                      {item.row_count} {item.row_count === 1 ? "row" : "rows"}
                    </span>
                  )}
                  {item.execution_time_ms && (
                    <span>{item.execution_time_ms}ms</span>
                  )}
                  {item.error && (
                    <span className="text-destructive">Error</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRerun(item)}
                >
                  <Play className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete query?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove this query from history. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(item.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
