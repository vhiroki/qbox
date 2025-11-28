import { useState } from "react";
import { MessageSquare, Table2, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ChatInterface from "./ChatInterface";
import DataSourcesPanel from "./DataSourcesPanel";
import type { Query, QueryTableSelection } from "@/types";

interface RightSidePanelProps {
  query: Query;
  queryId: string;
  selections: QueryTableSelection[];
  onSQLChange: (sql: string) => void;
  onSelectionChange: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => Promise<void>;
  onFileDeleted?: (fileId: string) => Promise<void>;
  onRemoveSelection: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    sourceType: string,
    label: string
  ) => void;
  fileInfoMap: Map<string, { name: string; viewName: string }>;
  connectionInfoMap: Map<string, { name: string; alias: string }>;
}

type PanelView = "tables" | "chat";

/**
 * Generate a view name for an S3 file (matches backend logic in s3_service.py).
 * Format: s3_{sanitized_file_name}
 */
function getS3ViewName(filePath: string): string {
  // Get file name without extension
  let fileName = filePath.split('/').pop() || filePath;
  if (fileName.includes('.')) {
    const parts = fileName.split('.');
    parts.pop(); // Remove extension
    fileName = parts.join('.');
  }

  // Sanitize file name (keep only alphanumeric and underscores)
  const fileNameSafe = fileName.replace(/[^a-zA-Z0-9_]/g, '_');

  return `s3_${fileNameSafe}`;
}

export default function RightSidePanel({
  query,
  queryId,
  selections,
  onSQLChange,
  onSelectionChange,
  onFileDeleted,
  onRemoveSelection,
  fileInfoMap,
  connectionInfoMap,
}: RightSidePanelProps) {
  const [activeView, setActiveView] = useState<PanelView>("tables");
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  const handleCopyToClipboard = async (label: string, badgeKey: string) => {
    try {
      await navigator.clipboard.writeText(label);
      setCopiedBadge(badgeKey);
      setTimeout(() => setCopiedBadge(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getSelectionLabel = (selection: QueryTableSelection): string => {
    if (selection.source_type === "file") {
      const fileInfo = fileInfoMap.get(selection.connection_id);
      return fileInfo?.viewName || selection.table_name;
    } else if (selection.source_type === "s3") {
      return getS3ViewName(selection.table_name);
    } else {
      // Database connection - use DuckDB alias format: pg_{sanitized_alias}
      const connectionInfo = connectionInfoMap.get(selection.connection_id);
      const alias = connectionInfo?.alias || selection.connection_id;
      const duckdbAlias = `pg_${alias.replace(/-/g, '_')}`;
      return `${duckdbAlias}.${selection.schema_name}.${selection.table_name}`;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Panel Toggle Header */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg mb-3 flex-shrink-0">
        <Button
          variant={activeView === "tables" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("tables")}
          className={cn(
            "flex-1 h-8 text-xs font-medium transition-all",
            activeView === "tables" 
              ? "shadow-sm" 
              : "hover:bg-muted/50"
          )}
        >
          <Table2 className="h-3.5 w-3.5 mr-1.5" />
          Tables
          {selections.length > 0 && (
            <span className="ml-1.5 bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
              {selections.length}
            </span>
          )}
        </Button>
        <Button
          variant={activeView === "chat" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveView("chat")}
          className={cn(
            "flex-1 h-8 text-xs font-medium transition-all",
            activeView === "chat" 
              ? "shadow-sm" 
              : "hover:bg-muted/50"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          AI Chat
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "tables" ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Selected Tables Badges */}
            <div className="mb-3 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {selections.length} {selections.length === 1 ? "table" : "tables"} selected
                </h3>
              </div>
              {selections.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selections.map((selection) => {
                    const label = getSelectionLabel(selection);
                    const badgeKey = `${selection.source_type}-${selection.connection_id}-${selection.schema_name}-${selection.table_name}`;
                    const isCopied = copiedBadge === badgeKey;

                    return (
                      <Badge
                        key={badgeKey}
                        variant="secondary"
                        className="pl-2 pr-1 py-0.5 text-xs gap-1"
                      >
                        <span className="truncate max-w-[200px]">{label}</span>
                        <button
                          onClick={() => handleCopyToClipboard(label, badgeKey)}
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                          aria-label={`Copy ${label}`}
                          title="Copy to clipboard"
                        >
                          {isCopied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            onRemoveSelection(
                              selection.connection_id,
                              selection.schema_name,
                              selection.table_name,
                              selection.source_type,
                              label
                            )
                          }
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                          aria-label={`Remove ${label}`}
                          title="Remove table"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Data Sources Tree View */}
            <div className="flex-1 overflow-hidden">
              <DataSourcesPanel
                queryId={queryId}
                selections={selections}
                onSelectionChange={onSelectionChange}
                onFileDeleted={onFileDeleted}
              />
            </div>
          </div>
        ) : (
          <ChatInterface
            query={query}
            onSQLChange={onSQLChange}
          />
        )}
      </div>
    </div>
  );
}

