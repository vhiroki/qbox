import { useState } from "react";
import { generateDuckDBIdentifier } from "../utils/identifier";
import {
  Database,
  Cloud,
  FileText,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  X,
  Loader2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/services/api";
import { getSourceTypeIconColor } from "@/constants/connectionColors";
import type { QueryTableSelection, ColumnMetadata } from "@/types";

interface SelectedTablesViewProps {
  selections: QueryTableSelection[];
  onRemoveSelection: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    sourceType: string,
    label: string
  ) => void;
  onAddTableClick: () => void;
  fileInfoMap: Map<string, { name: string; viewName: string }>;
  connectionInfoMap: Map<string, { name: string }>;
}

interface TableDetails {
  columns: ColumnMetadata[];
  row_count?: number;
}

/**
 * Generate a view name for an S3 file (matches backend logic in s3_service.py).
 * Format: {schema_identifier}.{table_name}
 * Example: my_s3_bucket.sales_2024
 */
function getS3ViewName(filePath: string, connectionName: string): string {
  // Generate schema identifier from connection name (same as backend)
  const schemaIdentifier = generateDuckDBIdentifier(connectionName);

  // Extract file name without extension and sanitize
  let fileName = filePath.split("/").pop() || filePath;
  if (fileName.includes(".")) {
    const parts = fileName.split(".");
    parts.pop();
    fileName = parts.join(".");
  }
  const fileNameSafe = fileName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");

  // Ensure table name doesn't start with a digit
  const tableName = fileNameSafe && /^\d/.test(fileNameSafe)
    ? `file_${fileNameSafe}`
    : fileNameSafe;

  return `${schemaIdentifier}.${tableName}`;
}

/**
 * Get source type icon
 */
function SourceTypeIcon({ sourceType }: { sourceType: string }) {
  const colorClass = getSourceTypeIconColor(sourceType);
  switch (sourceType) {
    case "connection":
      return <Database className={`h-4 w-4 ${colorClass}`} />;
    case "s3":
      return <Cloud className={`h-4 w-4 ${colorClass}`} />;
    case "file":
      return <FileText className={`h-4 w-4 ${colorClass}`} />;
    default:
      return <Database className={`h-4 w-4 ${colorClass}`} />;
  }
}

/**
 * Get human-readable source type label
 */
function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case "connection":
      return "Database";
    case "s3":
      return "S3";
    case "file":
      return "File";
    default:
      return sourceType;
  }
}

export default function SelectedTablesView({
  selections,
  onRemoveSelection,
  onAddTableClick,
  fileInfoMap,
  connectionInfoMap,
}: SelectedTablesViewProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableDetails, setTableDetails] = useState<Map<string, TableDetails>>(
    new Map()
  );
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [copiedQualifiedName, setCopiedQualifiedName] = useState<string | null>(null);

  const getTableKey = (selection: QueryTableSelection): string => {
    return `${selection.source_type}-${selection.connection_id}-${selection.schema_name}-${selection.table_name}`;
  };

  const getQualifiedName = (selection: QueryTableSelection): string => {
    if (selection.source_type === "file") {
      const fileInfo = fileInfoMap.get(selection.connection_id);
      return fileInfo?.viewName || selection.table_name;
    } else if (selection.source_type === "s3") {
      const connectionInfo = connectionInfoMap.get(selection.connection_id);
      const connectionName = connectionInfo?.name || selection.connection_id;
      return getS3ViewName(selection.table_name, connectionName);
    } else {
      const connectionInfo = connectionInfoMap.get(selection.connection_id);
      const identifier = connectionInfo?.name ? generateDuckDBIdentifier(connectionInfo.name) : selection.connection_id.replace(/-/g, "_");
      return `${identifier}.${selection.schema_name}.${selection.table_name}`;
    }
  };

  const getDisplayName = (selection: QueryTableSelection): string => {
    if (selection.source_type === "file") {
      const fileInfo = fileInfoMap.get(selection.connection_id);
      return fileInfo?.name || selection.table_name;
    } else if (selection.source_type === "s3") {
      // Show just the file name for S3
      return selection.table_name.split("/").pop() || selection.table_name;
    } else {
      return selection.table_name;
    }
  };

  const getSubtitle = (selection: QueryTableSelection): string => {
    if (selection.source_type === "connection") {
      const connectionInfo = connectionInfoMap.get(selection.connection_id);
      const connName = connectionInfo?.name || "Database";
      return `${connName} • ${selection.schema_name}`;
    } else if (selection.source_type === "s3") {
      // Show bucket/path info
      const pathParts = selection.table_name.split("/");
      if (pathParts.length > 1) {
        return pathParts.slice(0, -1).join("/");
      }
      return "S3 Bucket";
    }
    return "";
  };

  const handleToggleExpand = async (selection: QueryTableSelection) => {
    const key = getTableKey(selection);
    const isCurrentlyExpanded = expandedTables.has(key);

    if (isCurrentlyExpanded) {
      setExpandedTables((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setExpandedTables((prev) => new Set(prev).add(key));

      // Load details if not already loaded
      if (!tableDetails.has(key) && !loadingDetails.has(key)) {
        await loadTableDetails(selection, key);
      }
    }
  };

  const loadTableDetails = async (
    selection: QueryTableSelection,
    key: string
  ) => {
    setLoadingDetails((prev) => new Set(prev).add(key));

    try {
      let details: TableDetails;

      if (selection.source_type === "connection") {
        // Load from database connection
        const result = await api.getTableDetails(
          selection.connection_id,
          selection.schema_name,
          selection.table_name
        );
        details = {
          columns: result.columns || [],
          row_count: result.row_count,
        };
      } else if (selection.source_type === "file") {
        // Load from file metadata
        const result = await api.getFileMetadata(selection.connection_id);
        details = {
          columns: result.columns || [],
          row_count: result.row_count,
        };
      } else if (selection.source_type === "s3") {
        // Load from S3 file metadata
        const result = await api.getS3FileMetadata(
          selection.connection_id,
          selection.table_name
        );
        details = {
          columns: (result.columns || []).map((col) => ({
            ...col,
            is_primary_key: false, // S3 files don't have primary keys
          })),
          row_count: result.row_count,
        };
      } else {
        details = { columns: [] };
      }

      setTableDetails((prev) => new Map(prev).set(key, details));
    } catch (err) {
      console.error("Failed to load table details:", err);
      setTableDetails((prev) =>
        new Map(prev).set(key, { columns: [], row_count: undefined })
      );
    } finally {
      setLoadingDetails((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCopyIdentifier = async (identifier: string, key: string) => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopiedQualifiedName(key);
      setTimeout(() => setCopiedQualifiedName(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (selections.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <div className="bg-muted/30 rounded-full p-4 mb-4">
          <Database className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-medium mb-1">No tables selected</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add tables to use in your query
        </p>
        <Button onClick={onAddTableClick} size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Manage Tables
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="text-sm text-muted-foreground">
          {selections.length} {selections.length === 1 ? "table" : "tables"}
        </span>
        <Button onClick={onAddTableClick} size="sm" variant="outline">
          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
          Manage Tables
        </Button>
      </div>

      {/* Tables List */}
      <ScrollArea className="flex-1 h-0">
        <div className="space-y-2 pr-4">
          {selections.map((selection) => {
            const key = getTableKey(selection);
            const isExpanded = expandedTables.has(key);
            const isLoading = loadingDetails.has(key);
            const details = tableDetails.get(key);
            const qualifiedName = getQualifiedName(selection);
            const displayName = getDisplayName(selection);
            const subtitle = getSubtitle(selection);
            const isCopied = copiedQualifiedName === key;

            return (
              <div
                key={key}
                className="border rounded-lg bg-card overflow-hidden"
              >
                {/* Table Header */}
                <div className="flex items-center gap-2 p-3">
                  {/* Expand Button */}
                  <button
                    onClick={() => handleToggleExpand(selection)}
                    className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Source Type Icon */}
                  <SourceTypeIcon sourceType={selection.source_type} />

                  {/* Table Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {displayName}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {getSourceTypeLabel(selection.source_type)}
                      </span>
                    </div>
                    {subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* Row Count */}
                  {details?.row_count != null && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {details.row_count.toLocaleString()} rows
                    </span>
                  )}

                  {/* Copy Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 flex-shrink-0"
                    onClick={() => handleCopyIdentifier(qualifiedName, key)}
                    title={`Copy identifier: ${qualifiedName}`}
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      onRemoveSelection(
                        selection.connection_id,
                        selection.schema_name,
                        selection.table_name,
                        selection.source_type,
                        qualifiedName
                      )
                    }
                    title="Remove from query"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Qualified Name (always visible) */}
                <div className="px-3 pb-2 -mt-1">
                  <code className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                    {qualifiedName}
                  </code>
                </div>

                {/* Expanded Content - Columns */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 px-3 py-2">
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading columns...
                      </div>
                    ) : details?.columns && details.columns.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                          Columns ({details.columns.length})
                        </div>
                        {details.columns.map((column) => (
                          <div
                            key={column.name}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="font-medium text-foreground">
                              {column.name}
                            </span>
                            <span className="font-mono text-muted-foreground text-[11px]">
                              {column.type}
                            </span>
                            {column.is_primary_key && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded">
                                PK
                              </span>
                            )}
                            {column.nullable === false && (
                              <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1 py-0.5 rounded">
                                NOT NULL
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground py-2">
                        No column information available
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

