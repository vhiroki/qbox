import { useNavigate } from "react-router-dom";
import { FileCode, SquarePen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryStore } from "../stores";

interface HomePageProps {
  onCreateQuery: () => void;
  isCreating: boolean;
}

export default function HomePage({ onCreateQuery, isCreating }: HomePageProps) {
  const navigate = useNavigate();
  const queries = useQueryStore((state) => state.queries);

  // Get the 5 most recently updated queries
  const recentQueries = [...queries]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

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
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <FileCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-semibold mb-2">Welcome to QBox</h1>
          <p className="text-muted-foreground">
            Build and manage SQL queries across multiple data sources
          </p>
        </div>

        {/* Create Query Button */}
        <div className="mb-8">
          <Button
            onClick={onCreateQuery}
            disabled={isCreating}
            className="w-full h-12 text-base"
            size="lg"
          >
            <SquarePen className="h-5 w-5 mr-2" />
            {isCreating ? "Creating..." : "Create New Query"}
          </Button>
        </div>

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Recent Queries</span>
            </div>
            <div className="space-y-2">
              {recentQueries.map((query) => (
                <button
                  key={query.id}
                  onClick={() => navigate(`/query/${query.id}`)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="font-medium truncate">{query.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(query.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no queries */}
        {queries.length === 0 && (
          <div className="text-center text-muted-foreground text-sm">
            <p>No queries yet. Create your first query to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
