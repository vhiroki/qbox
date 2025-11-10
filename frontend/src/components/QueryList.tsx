import { useState, useEffect } from "react";
import { Plus, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "../services/api";
import type { Query } from "../types";

interface QueryListProps {
  selectedQueryId: string | null;
  onSelectQuery: (queryId: string) => void;
  refreshTrigger?: number;
}

export default function QueryList({
  selectedQueryId,
  onSelectQuery,
  refreshTrigger,
}: QueryListProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState("");

  useEffect(() => {
    loadQueries();
  }, [refreshTrigger]);

  const loadQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listQueries();
      setQueries(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load queries");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setQueryName("");
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!queryName.trim()) {
      setError("Query name is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newQuery = await api.createQuery({ name: queryName.trim() });
      setCreateDialogOpen(false);
      setQueryName("");
      await loadQueries();
      onSelectQuery(newQuery.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create query");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <Button onClick={handleCreate} disabled={loading} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Query
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && queries.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            Loading queries...
          </div>
        )}

        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {!loading && queries.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <FileCode className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No queries yet</p>
            <p className="text-xs mt-1">
              Create your first query to get started
            </p>
          </div>
        )}

        <div className="p-2">
          {queries.map((query) => (
            <button
              key={query.id}
              onClick={() => onSelectQuery(query.id)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                selectedQueryId === query.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <div className="font-medium truncate">{query.name}</div>
              <div className="text-xs opacity-70 mt-1">
                {formatDate(query.updated_at)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Query</DialogTitle>
            <DialogDescription>
              Give your new query a descriptive name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="query-name">Query Name</Label>
              <Input
                id="query-name"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="e.g., Sales Analysis"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={loading}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
