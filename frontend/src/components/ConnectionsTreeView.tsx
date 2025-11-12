import { useState, useEffect } from "react";
import { Database, ChevronRight, ChevronDown, Table as TableIcon, Loader2, RefreshCw, Filter, Eye, EyeOff, Copy, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { api } from "@/services/api";
import type { ConnectionMetadata, SchemaMetadata, TableMetadata, QueryTableSelection } from "@/types";

interface ConnectionsTreeViewProps {
  selections: QueryTableSelection[];
  onSelectionChange: (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => Promise<void>;
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function ConnectionsTreeView({
  selections,
  onSelectionChange,
}: ConnectionsTreeViewProps) {
  // Use Zustand store for cached metadata
  const loadAllMetadata = useConnectionStore((state) => state.loadAllMetadata);

  const [allMetadata, setAllMetadata] = useState<ConnectionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [togglingTable, setTogglingTable] = useState<string | null>(null);

  // Track which tables are loading their details
  const [loadingTableDetails, setLoadingTableDetails] = useState<Set<string>>(new Set());

  // Track which table was copied (for showing checkmark feedback)
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  // Store connection aliases for full qualified names
  const [connectionAliases, setConnectionAliases] = useState<Map<string, string>>(new Map());

  // Filter and display options
  const [tableFilter, setTableFilter] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Load all connections metadata on mount (uses cache if available)
  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const metadata = await loadAllMetadata();
        setAllMetadata(metadata);

        // Load connection aliases
        const aliasMap = new Map<string, string>();
        for (const conn of metadata) {
          try {
            const connectionInfo = await api.getSavedConnection(conn.connection_id);
            aliasMap.set(conn.connection_id, connectionInfo.alias || connectionInfo.name);
          } catch (err) {
            // Fallback to connection name if we can't fetch the saved connection
            aliasMap.set(conn.connection_id, conn.connection_name);
          }
        }
        setConnectionAliases(aliasMap);
      } catch (err: any) {
        setError(err.message || "Failed to load connections");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [loadAllMetadata]);

  // Auto-expand connections that have selected tables
  useEffect(() => {
    if (allMetadata.length > 0 && selections.length > 0) {
      const newExpanded: ExpandedState = { ...expanded };

      selections.forEach((selection) => {
        if (selection.source_type === "connection") {
          const connectionKey = `connection:${selection.connection_id}`;
          const schemaKey = `schema:${selection.connection_id}:${selection.schema_name}`;

          // Expand connection and schema if they have selected tables
          newExpanded[connectionKey] = true;
          newExpanded[schemaKey] = true;
        }
      });

      setExpanded(newExpanded);
    }
  }, [allMetadata, selections.length]);

  const toggleExpand = async (key: string, connectionId?: string, schemaName?: string, tableName?: string) => {
    const willBeExpanded = !expanded[key];
    setExpanded((prev) => ({ ...prev, [key]: willBeExpanded }));

    // If this is a table columns expansion and we're expanding (not collapsing)
    if (willBeExpanded && key.startsWith("columns:") && connectionId && schemaName && tableName) {
      await loadTableDetails(connectionId, schemaName, tableName);
    }
  };

  const loadTableDetails = async (connectionId: string, schemaName: string, tableName: string) => {
    const tableKey = getTableKey(connectionId, schemaName, tableName);

    // Check if table already has details loaded
    const connection = allMetadata.find((c) => c.connection_id === connectionId);
    const schema = connection?.schemas.find((s) => s.name === schemaName);
    const table = schema?.tables.find((t) => t.name === tableName);

    // If table already has columns loaded, skip
    if (table?.columns && table.columns.length > 0) {
      return;
    }

    // If already loading, skip
    if (loadingTableDetails.has(tableKey)) {
      return;
    }

    // Mark as loading
    setLoadingTableDetails((prev) => new Set(prev).add(tableKey));

    try {
      const tableDetails = await api.getTableDetails(connectionId, schemaName, tableName);

      // Update the metadata with the loaded details
      setAllMetadata((prevMetadata) => {
        return prevMetadata.map((conn) => {
          if (conn.connection_id !== connectionId) return conn;

          return {
            ...conn,
            schemas: conn.schemas.map((sch) => {
              if (sch.name !== schemaName) return sch;

              return {
                ...sch,
                tables: sch.tables.map((tbl) => {
                  if (tbl.name !== tableName) return tbl;

                  return {
                    ...tbl,
                    columns: tableDetails.columns,
                    row_count: tableDetails.row_count,
                  };
                }),
              };
            }),
          };
        });
      });
    } catch (err: any) {
      console.error(`Failed to load table details for ${schemaName}.${tableName}:`, err);
      // Optionally show an error toast here
    } finally {
      // Remove from loading set
      setLoadingTableDetails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tableKey);
        return newSet;
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const metadata = await loadAllMetadata(true); // Force refresh
      setAllMetadata(metadata);
    } catch (err: any) {
      setError(err.message || "Failed to refresh connections");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isTableSelected = (
    connectionId: string,
    schemaName: string,
    tableName: string
  ): boolean => {
    return selections.some(
      (s) =>
        s.connection_id === connectionId &&
        s.schema_name === schemaName &&
        s.table_name === tableName &&
        s.source_type === "connection"
    );
  };

  const handleTableToggle = async (
    connectionId: string,
    schemaName: string,
    tableName: string,
    currentlyChecked: boolean
  ) => {
    const key = `${connectionId}:${schemaName}:${tableName}`;
    setTogglingTable(key);

    try {
      await onSelectionChange(
        connectionId,
        schemaName,
        tableName,
        !currentlyChecked,
        "connection"
      );
    } finally {
      setTogglingTable(null);
    }
  };

  const getTableKey = (connectionId: string, schemaName: string, tableName: string) => {
    return `${connectionId}:${schemaName}:${tableName}`;
  };

  const handleCopyTableName = async (connectionId: string, schemaName: string, tableName: string, event: React.MouseEvent) => {
    event.stopPropagation();

    // Get the connection alias
    const alias = connectionAliases.get(connectionId) || connectionId;

    // Build the full qualified name: alias.schema.table
    const fullQualifiedName = `${alias}.${schemaName}.${tableName}`;

    const tableKey = getTableKey(connectionId, schemaName, tableName);

    try {
      await navigator.clipboard.writeText(fullQualifiedName);
      setCopiedTable(tableKey);
      // Reset after 2 seconds
      setTimeout(() => setCopiedTable(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  // Filter tables by name
  const matchesFilter = (tableName: string) => {
    if (!tableFilter.trim()) return true;
    return tableName.toLowerCase().includes(tableFilter.toLowerCase());
  };

  // Filter metadata based on selected options
  const getFilteredMetadata = () => {
    return allMetadata.map((connection) => {
      const filteredSchemas = connection.schemas.map((schema) => {
        const filteredTables = schema.tables.filter((table) => {
          // Filter by table name
          if (!matchesFilter(table.name)) return false;

          // Filter by selection status
          if (showOnlySelected) {
            return isTableSelected(connection.connection_id, schema.name, table.name);
          }

          return true;
        });

        return { ...schema, tables: filteredTables };
      }).filter((schema) => schema.tables.length > 0); // Only show schemas with visible tables

      return { ...connection, schemas: filteredSchemas };
    }).filter((connection) => connection.schemas.length > 0); // Only show connections with visible schemas
  };

  const filteredMetadata = getFilteredMetadata();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading connections...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (allMetadata.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center text-muted-foreground">
        <div>
          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No connections available</p>
          <p className="text-xs mt-1">Create a connection in the Connections page</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="space-y-1 pr-4 h-full">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Database Connections
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 px-2"
              title="Refresh connections"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Filter and Toggle Controls */}
          <div className="space-y-2 mb-3 px-2">
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter tables..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              variant={showOnlySelected ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className="h-7 w-full text-xs"
            >
              {showOnlySelected ? (
                <>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  Showing Selected Only
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-2" />
                  Showing All Tables
                </>
              )}
            </Button>
          </div>

          {filteredMetadata.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center text-muted-foreground border-2 border-dashed rounded-md mx-2">
              <div>
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">
                  {tableFilter || showOnlySelected
                    ? "No tables match your filters"
                    : "No tables available"}
                </p>
              </div>
            </div>
          ) : (
            filteredMetadata.map((connection) => {
              const connectionKey = `connection:${connection.connection_id}`;
              const isConnectionExpanded = expanded[connectionKey] || false;
              const hasSelectedTables = selections.some(
                (s) => s.connection_id === connection.connection_id && s.source_type === "connection"
              );

              return (
                <div key={connection.connection_id} className="mb-2">
                  {/* Connection Level */}
                  <button
                    onClick={() => toggleExpand(connectionKey)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors group"
                  >
                    {isConnectionExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <Database
                      className={`h-4 w-4 flex-shrink-0 ${hasSelectedTables ? "text-primary" : "text-muted-foreground"
                        }`}
                    />
                    <span className="text-sm font-medium truncate flex-1 text-left">
                      {connection.connection_name}
                    </span>
                    {hasSelectedTables && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {selections.filter((s) => s.connection_id === connection.connection_id && s.source_type === "connection").length}
                      </span>
                    )}
                  </button>

                  {/* Schemas */}
                  {isConnectionExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {connection.schemas.map((schema: SchemaMetadata) => {
                        const schemaKey = `schema:${connection.connection_id}:${schema.name}`;
                        const isSchemaExpanded = expanded[schemaKey] || false;

                        return (
                          <div key={schema.name}>
                            {/* Schema Level */}
                            <button
                              onClick={() => toggleExpand(schemaKey)}
                              className="flex items-center gap-2 w-full px-2 py-1 hover:bg-muted/50 rounded-md transition-colors"
                            >
                              {isSchemaExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="text-xs text-muted-foreground truncate">
                                {schema.name}
                              </span>
                            </button>

                            {/* Tables */}
                            {isSchemaExpanded && (
                              <div className="ml-5 mt-1 space-y-0.5">
                                {schema.tables.map((table: TableMetadata) => {
                                  const isSelected = isTableSelected(
                                    connection.connection_id,
                                    schema.name,
                                    table.name
                                  );
                                  const tableKey = getTableKey(
                                    connection.connection_id,
                                    schema.name,
                                    table.name
                                  );
                                  const isToggling = togglingTable === tableKey;
                                  const columnKey = `columns:${tableKey}`;
                                  const areColumnsExpanded = expanded[columnKey] || false;

                                  return (
                                    <div key={table.name} className="space-y-0.5">
                                      {/* Table Level */}
                                      <div className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded-md transition-colors group">
                                        <Checkbox
                                          checked={isSelected}
                                          disabled={isToggling}
                                          onCheckedChange={() =>
                                            handleTableToggle(
                                              connection.connection_id,
                                              schema.name,
                                              table.name,
                                              isSelected
                                            )
                                          }
                                          className="flex-shrink-0"
                                        />
                                        <button
                                          onClick={() => toggleExpand(columnKey, connection.connection_id, schema.name, table.name)}
                                          className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                          {areColumnsExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          )}
                                          <TableIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-xs truncate">{table.name}</span>
                                          <button
                                            onClick={(e) => handleCopyTableName(connection.connection_id, schema.name, table.name, e)}
                                            className="opacity-0 group-hover:opacity-100 rounded-full hover:bg-muted p-0.5 transition-all flex-shrink-0 ml-1"
                                            aria-label={`Copy ${table.name}`}
                                            title="Copy full qualified name"
                                          >
                                            {copiedTable === tableKey ? (
                                              <Check className="h-3 w-3 text-green-500" />
                                            ) : (
                                              <Copy className="h-3 w-3 text-muted-foreground" />
                                            )}
                                          </button>
                                        </button>
                                        {loadingTableDetails.has(tableKey) && areColumnsExpanded ? (
                                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                                        ) : table.row_count != null ? (
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {table.row_count.toLocaleString()} rows
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* Columns (collapsed by default) */}
                                      {areColumnsExpanded && (
                                        <div className="ml-9 space-y-0.5 pb-1">
                                          {loadingTableDetails.has(tableKey) ? (
                                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Loading columns...
                                            </div>
                                          ) : table.columns && table.columns.length > 0 ? (
                                            table.columns.map((column) => (
                                              <div
                                                key={column.name}
                                                className="flex items-start gap-2 px-2 py-0.5 text-xs text-muted-foreground"
                                              >
                                                <span className="flex-shrink-0 font-medium">{column.name}</span>
                                                <span className="text-xs font-mono opacity-60 break-all flex-1">
                                                  {column.type}
                                                </span>
                                                {column.is_primary_key && (
                                                  <span className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded flex-shrink-0">
                                                    PK
                                                  </span>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                              No columns available
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }))}
        </div>
      </div>
    </ScrollArea>
  );
}

