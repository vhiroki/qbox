import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Database, Table, Columns, Key, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import type { ConnectionMetadata, SchemaMetadata, TableMetadata, ColumnMetadata } from "../types";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";

interface MetadataSidebarProps {
  connectionId: string | null;
}

export default function MetadataSidebar({ connectionId }: MetadataSidebarProps) {
  const [metadata, setMetadata] = useState<ConnectionMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (connectionId) {
      loadMetadata();
    } else {
      setMetadata(null);
    }
  }, [connectionId]);

  const loadMetadata = async () => {
    if (!connectionId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getMetadata(connectionId);
      setMetadata(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load metadata");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!connectionId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.refreshMetadata(connectionId);
      setMetadata(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to refresh metadata");
    } finally {
      setLoading(false);
    }
  };

  const toggleSchema = (schemaName: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleTable = (tableKey: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableKey)) {
      newExpanded.delete(tableKey);
    } else {
      newExpanded.add(tableKey);
    }
    setExpandedTables(newExpanded);
  };

  if (!connectionId) {
    return (
      <div className="w-80 border-r bg-muted/10 p-4">
        <div className="text-sm text-muted-foreground text-center mt-8">
          Select a connection to view metadata
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            Metadata
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {metadata && (
          <div className="text-xs text-muted-foreground">
            {metadata.connection_name}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && !metadata && (
          <div className="text-sm text-muted-foreground text-center">
            Loading metadata...
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {metadata && (
          <div className="space-y-1">
            {metadata.schemas.map((schema) => (
              <SchemaNode
                key={schema.name}
                schema={schema}
                expanded={expandedSchemas.has(schema.name)}
                onToggle={() => toggleSchema(schema.name)}
                expandedTables={expandedTables}
                onToggleTable={toggleTable}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SchemaNodeProps {
  schema: SchemaMetadata;
  expanded: boolean;
  onToggle: () => void;
  expandedTables: Set<string>;
  onToggleTable: (tableKey: string) => void;
}

function SchemaNode({ schema, expanded, onToggle, expandedTables, onToggleTable }: SchemaNodeProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded text-sm"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <Database className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium truncate">{schema.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          ({schema.tables.length})
        </span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-1 mt-1">
          {schema.tables.map((table) => {
            const tableKey = `${schema.name}.${table.name}`;
            return (
              <TableNode
                key={tableKey}
                table={table}
                tableKey={tableKey}
                expanded={expandedTables.has(tableKey)}
                onToggle={() => onToggleTable(tableKey)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TableNodeProps {
  table: TableMetadata;
  tableKey: string;
  expanded: boolean;
  onToggle: () => void;
}

function TableNode({ table, expanded, onToggle }: TableNodeProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded text-sm"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <Table className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{table.name}</span>
        {table.row_count !== null && table.row_count !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">
            {table.row_count.toLocaleString()} rows
          </span>
        )}
      </button>

      {expanded && table.columns && (
        <div className="ml-4 space-y-0.5 mt-1">
          {table.columns.map((column) => (
            <ColumnNode key={column.name} column={column} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ColumnNodeProps {
  column: ColumnMetadata;
}

function ColumnNode({ column }: ColumnNodeProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs">
      {column.is_primary_key ? (
        <Key className="h-3 w-3 text-yellow-600 flex-shrink-0" />
      ) : (
        <Columns className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      <span className="truncate font-mono">{column.name}</span>
      <span className="text-muted-foreground ml-auto flex-shrink-0">
        {column.type}
        {!column.nullable && <span className="text-red-500 ml-1">*</span>}
      </span>
    </div>
  );
}
