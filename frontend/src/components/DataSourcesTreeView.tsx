import { useState, useEffect } from "react";
import { Database, ChevronRight, ChevronDown, Table as TableIcon, Loader2, RefreshCw, Filter, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { ConnectionMetadata, SchemaMetadata, TableMetadata, QueryTableSelection } from "@/types";

interface DataSourcesTreeViewProps {
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

export default function DataSourcesTreeView({
  selections,
  onSelectionChange,
}: DataSourcesTreeViewProps) {
  // Use Zustand store for cached metadata
  const loadAllMetadata = useConnectionStore((state) => state.loadAllMetadata);
  const storeError = useConnectionStore((state) => state.error);

  const [allMetadata, setAllMetadata] = useState<ConnectionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [togglingTable, setTogglingTable] = useState<string | null>(null);

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
      } catch (err: any) {
        setError(storeError || err.message || "Failed to load connections");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [loadAllMetadata, storeError]);

  // Auto-expand connections that have selected tables
  useEffect(() => {
    if (allMetadata.length > 0 && selections.length > 0) {
      const newExpanded: ExpandedState = { ...expanded };

      selections.forEach((selection) => {
        const connectionKey = `connection:${selection.connection_id}`;
        const schemaKey = `schema:${selection.connection_id}:${selection.schema_name}`;

        // Expand connection and schema if they have selected tables
        newExpanded[connectionKey] = true;
        newExpanded[schemaKey] = true;
      });

      setExpanded(newExpanded);
    }
  }, [allMetadata, selections.length]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const metadata = await loadAllMetadata(true); // Force refresh
      setAllMetadata(metadata);
    } catch (err: any) {
      setError(storeError || err.message || "Failed to refresh connections");
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
        s.table_name === tableName
    );
  };

  const handleTableToggle = async (
    connectionId: string,
    schemaName: string,
    tableName: string,
    currentlyChecked: boolean,
    sourceType: string = "connection"
  ) => {
    const key = `${connectionId}:${schemaName}:${tableName}`;
    setTogglingTable(key);

    try {
      await onSelectionChange(
        connectionId,
        schemaName,
        tableName,
        !currentlyChecked,
        sourceType
      );
    } finally {
      setTogglingTable(null);
    }
  };

  const getTableKey = (connectionId: string, schemaName: string, tableName: string) => {
    return `${connectionId}:${schemaName}:${tableName}`;
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
        Loading data sources...
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
    <ScrollArea className="h-full">
      <div className="space-y-1 pr-4">
        {/* Database Connections Section */}
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
                (s) => s.connection_id === connection.connection_id
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
                        {selections.filter((s) => s.connection_id === connection.connection_id).length}
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
                                      <div className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 rounded-md transition-colors">
                                        <Checkbox
                                          checked={isSelected}
                                          disabled={isToggling}
                                          onCheckedChange={() =>
                                            handleTableToggle(
                                              connection.connection_id,
                                              schema.name,
                                              table.name,
                                              isSelected,
                                              "connection"
                                            )
                                          }
                                          className="flex-shrink-0"
                                        />
                                        <button
                                          onClick={() => toggleExpand(columnKey)}
                                          className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                          {areColumnsExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          )}
                                          <TableIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-xs truncate">{table.name}</span>
                                        </button>
                                        {table.row_count != null && (
                                          <span className="text-xs text-muted-foreground flex-shrink-0">
                                            {table.row_count.toLocaleString()}
                                          </span>
                                        )}
                                      </div>

                                      {/* Columns (collapsed by default) */}
                                      {areColumnsExpanded && (
                                        <div className="ml-9 space-y-0.5 pb-1">
                                          {table.columns.map((column) => (
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
                                          ))}
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

