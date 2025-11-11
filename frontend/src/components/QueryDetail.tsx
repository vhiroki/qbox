import { useState, useEffect } from "react";
import { Plus, Trash2, Database, X, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../services/api";
import ChatInterface from "./ChatInterface";
import AddTablesModal from "./AddTablesModal";
import type {
  Query,
  QueryTableSelection,
  TableMetadata,
} from "../types";

interface QueryDetailProps {
  queryId: string;
  onQueryDeleted: () => void;
  onQueryRenamed?: () => void;
}

export default function QueryDetail({
  queryId,
  onQueryDeleted,
  onQueryRenamed,
}: QueryDetailProps) {
  const [query, setQuery] = useState<Query | null>(null);
  const [selections, setSelections] = useState<QueryTableSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newQueryName, setNewQueryName] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [sqlEdited, setSqlEdited] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableMetadataCache, setTableMetadataCache] = useState<Map<string, TableMetadata>>(new Map());
  const [connectionNames, setConnectionNames] = useState<Map<string, string>>(new Map());
  const [addTablesModalOpen, setAddTablesModalOpen] = useState(false);

  useEffect(() => {
    loadQueryData();
  }, [queryId]);

  useEffect(() => {
    if (query) {
      setSqlText(query.sql_text);
      setSqlEdited(false);
    }
  }, [query?.sql_text]);

  const loadQueryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [queryData, selectionsData, connectionsData] = await Promise.all([
        api.getQuery(queryId),
        api.getQuerySelections(queryId),
        api.listConnections(),
      ]);

      setQuery(queryData);
      setSelections(selectionsData.selections);
      
      // Build connection names map - need to get full connection details
      const namesMap = new Map<string, string>();
      for (const conn of connectionsData) {
        try {
          const metadata = await api.getMetadata(conn.id);
          namesMap.set(conn.id, metadata.connection_name);
        } catch {
          namesMap.set(conn.id, conn.id);
        }
      }
      setConnectionNames(namesMap);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load query");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTable = async (selection: QueryTableSelection) => {
    try {
      await api.removeQuerySelection(queryId, {
        connection_id: selection.connection_id,
        schema_name: selection.schema_name,
        table_name: selection.table_name,
      });

      setSelections((prev) =>
        prev.filter(
          (s) =>
            !(
              s.connection_id === selection.connection_id &&
              s.schema_name === selection.schema_name &&
              s.table_name === selection.table_name
            )
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to remove table");
    }
  };

  const handleDeleteQuery = async () => {
    try {
      setLoading(true);
      await api.deleteQuery(queryId);
      setDeleteDialogOpen(false);
      onQueryDeleted();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete query");
      setLoading(false);
    }
  };

  const handleRenameQuery = async () => {
    if (!newQueryName.trim()) {
      setError("Query name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const updatedQuery = await api.updateQueryName(queryId, newQueryName.trim());
      setQuery(updatedQuery);
      setRenameDialogOpen(false);
      setNewQueryName("");
      setError(null);
      
      // Notify parent to refresh the query list
      if (onQueryRenamed) {
        onQueryRenamed();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to rename query");
    } finally {
      setLoading(false);
    }
  };

  const handleSQLUpdate = (updatedQuery: Query) => {
    setQuery(updatedQuery);
  };

  const getTableKey = (selection: QueryTableSelection) => {
    return `${selection.connection_id}:${selection.schema_name}:${selection.table_name}`;
  };

  const toggleTableExpansion = async (selection: QueryTableSelection) => {
    const key = getTableKey(selection);
    const newExpanded = new Set(expandedTables);
    
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
      setExpandedTables(newExpanded);
    } else {
      newExpanded.add(key);
      setExpandedTables(newExpanded);
      
      // Load metadata if not cached
      if (!tableMetadataCache.has(key)) {
        try {
          const metadata = await api.getMetadata(selection.connection_id);
          const schema = metadata.schemas.find((s) => s.name === selection.schema_name);
          const table = schema?.tables.find((t) => t.name === selection.table_name);
          
          if (table) {
            setTableMetadataCache(new Map(tableMetadataCache).set(key, table));
          }
        } catch (err: any) {
          console.error("Failed to load table metadata:", err);
        }
      }
    }
  };

  const handleSQLChange = (value: string | undefined) => {
    const newValue = value || "";
    setSqlText(newValue);
    setSqlEdited(newValue !== query?.sql_text);
  };

  const handleSaveSQL = async () => {
    if (!sqlEdited || !query) return;

    try {
      const updated = await api.updateQuerySQL(query.id, {
        sql_text: sqlText,
      });
      setSqlEdited(false);
      setQuery(updated);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to save SQL. Please try again."
      );
    }
  };

  if (loading && !query) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading query...</div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Query not found</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-muted/10 p-4">
        <div className="flex items-start justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <h2 className="text-2xl font-bold">{query.name}</h2>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={() => {
                  setNewQueryName(query.name);
                  setRenameDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename Query
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Query
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Tabs for SQL and Tables */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="h-full pr-3">
              <Tabs defaultValue="sql" className="h-full flex flex-col">
                <TabsList className="w-full justify-start mb-4 flex-shrink-0">
                  <TabsTrigger value="sql">SQL Query</TabsTrigger>
                  <TabsTrigger value="tables">
                    Connected Tables ({selections.length})
                  </TabsTrigger>
                </TabsList>

                {/* SQL Query Tab */}
                <TabsContent value="sql" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      {sqlEdited && (
                        <Button onClick={handleSaveSQL} size="sm" variant="outline" className="ml-auto">
                          Save SQL
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 border rounded-md overflow-hidden">
                      <Editor
                        defaultLanguage="sql"
                        value={sqlText}
                        onChange={handleSQLChange}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          wordWrap: "on",
                        }}
                      />
                    </div>
                    {sqlEdited && (
                      <p className="text-xs text-muted-foreground mt-2 flex-shrink-0">
                        SQL has been modified. Click "Save SQL" to persist changes.
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Connected Tables Tab */}
                <TabsContent value="tables" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden">
                  <div className="h-full flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {selections.length} {selections.length === 1 ? "table" : "tables"} connected
                      </h3>
                      <Button onClick={() => setAddTablesModalOpen(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Tables
                      </Button>
                    </div>
                    {selections.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No tables connected yet</p>
                          <p className="text-xs mt-1">
                            Click "Add Tables" to get started
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {selections.map((selection) => {
                          const key = getTableKey(selection);
                          const isExpanded = expandedTables.has(key);
                          const metadata = tableMetadataCache.get(key);

                          return (
                            <Card key={key} className="overflow-hidden py-0 gap-0">
                              <CardHeader className="p-3 pb-2 px-3">
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    onClick={() => toggleTableExpansion(selection)}
                                    className="flex items-center gap-2 flex-1 text-left group"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Database className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                                        <span className="font-medium text-sm truncate">
                                          {selection.schema_name}.{selection.table_name}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {connectionNames.get(selection.connection_id) || selection.connection_id}
                                        {metadata && (
                                          <span className="ml-2">
                                            • {metadata.columns.length} columns
                                            {metadata.row_count !== undefined && 
                                              ` • ${metadata.row_count.toLocaleString()} rows`
                                            }
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => handleRemoveTable(selection)}
                                    title="Remove table"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </CardHeader>

                              {isExpanded && (
                                <CardContent className="p-3 pt-0 border-t">
                                  {metadata ? (
                                    <div className="mt-2">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="border-b">
                                            <TableHead className="h-7 py-1 text-xs font-medium">Column</TableHead>
                                            <TableHead className="h-7 py-1 text-xs font-medium">Type</TableHead>
                                            <TableHead className="h-7 py-1 text-xs font-medium w-20">Constraints</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {metadata.columns.map((column) => (
                                            <TableRow key={column.name} className="hover:bg-muted/50">
                                              <TableCell className="py-1 font-medium text-sm">
                                                {column.name}
                                              </TableCell>
                                              <TableCell className="py-1 font-mono text-xs text-muted-foreground">
                                                <div className="break-words whitespace-normal">
                                                  {column.type}
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-1">
                                                <div className="flex gap-1">
                                                  {column.is_primary_key && (
                                                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                      PK
                                                    </span>
                                                  )}
                                                  {!column.nullable && (
                                                    <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 px-1.5 py-0.5 rounded">
                                                      NN
                                                    </span>
                                                  )}
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <div className="text-center py-3 text-sm text-muted-foreground">
                                      Loading columns...
                                    </div>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Chat */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="h-full pl-3">
              <ChatInterface 
                query={query} 
                onSQLUpdate={handleSQLUpdate}
                onSQLChange={(sql) => {
                  setSqlText(sql);
                  setSqlEdited(false);
                }}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Query</DialogTitle>
            <DialogDescription>
              Enter a new name for this query.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="query-name">Query Name</Label>
              <Input
                id="query-name"
                value={newQueryName}
                onChange={(e) => setNewQueryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameQuery();
                  }
                }}
                placeholder="Enter query name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setNewQueryName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameQuery} disabled={loading || !newQueryName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Query</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{query.name}"? This will remove
              all table selections and chat history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuery} disabled={loading}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tables Modal */}
      <AddTablesModal
        open={addTablesModalOpen}
        onClose={() => setAddTablesModalOpen(false)}
        queryId={queryId}
        onTablesAdded={() => {
          // Reload query data to reflect new table selections
          loadQueryData();
        }}
      />
    </div>
  );
}
