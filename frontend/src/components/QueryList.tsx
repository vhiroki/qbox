import { useState, useEffect } from "react";
import { Plus, FileCode, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import SettingsModal from "./SettingsModal";
import { useQueryStore } from "../stores";

interface QueryListProps {
  currentPage?: 'queries' | 'connections';
  selectedQueryId?: string | null;
}

export default function QueryList({
  currentPage = 'queries',
  selectedQueryId,
}: QueryListProps) {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [queryName, setQueryName] = useState("");

  // Zustand store
  const queries = useQueryStore((state) => state.queries);
  const isLoading = useQueryStore((state) => state.isLoading);
  const error = useQueryStore((state) => state.error);
  const loadQueries = useQueryStore((state) => state.loadQueries);
  const createQuery = useQueryStore((state) => state.createQuery);
  const setError = useQueryStore((state) => state.setError);
  const clearError = useQueryStore((state) => state.clearError);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const handleCreate = () => {
    setQueryName("");
    clearError();
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!queryName.trim()) {
      setError("Query name is required");
      return;
    }

    try {
      const newQuery = await createQuery(queryName.trim());
      setCreateDialogOpen(false);
      setQueryName("");
      navigate(`/query/${newQuery.id}`);
    } catch (err) {
      // Error is already set in the store
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

  const handleDataCleared = async () => {
    // Navigate to home
    navigate('/');
    // Reload queries
    await loadQueries();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Section */}
      <div className="p-4 border-b space-y-3">
        <div>
          <h1 className="text-2xl font-bold">QBox</h1>
          <p className="text-xs text-muted-foreground">Data Query Application</p>
        </div>

        {/* Navigation Button */}
        <Button
          variant={currentPage === 'connections' ? 'default' : 'outline'}
          onClick={() => navigate('/connections')}
          className="w-full"
        >
          <Database className="h-4 w-4 mr-2" />
          Connections
        </Button>

        {/* Create Query Button */}
        <Button onClick={handleCreate} disabled={isLoading} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Query
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">{isLoading && queries.length === 0 && (
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

        {!isLoading && queries.length === 0 && (
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
              onClick={() => navigate(`/query/${query.id}`)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${selectedQueryId === query.id
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

      {/* Settings Button at Bottom */}
      <div className="p-4 border-t">
        <SettingsModal onDataCleared={handleDataCleared} />
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
            <Button onClick={handleCreateSubmit} disabled={isLoading}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
