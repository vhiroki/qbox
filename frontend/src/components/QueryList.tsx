import { useEffect } from "react";
import { FileCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

  // Zustand store
  const queries = useQueryStore((state) => state.queries);
  const isLoading = useQueryStore((state) => state.isLoading);
  const error = useQueryStore((state) => state.error);
  const loadQueries = useQueryStore((state) => state.loadQueries);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

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
    navigate('/');
    await loadQueries();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Query List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && queries.length === 0 && (
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

      {/* Settings Button at Bottom */}
      <div className="p-3 border-t">
        <SettingsModal onDataCleared={handleDataCleared} />
      </div>
    </div>
  );
}
