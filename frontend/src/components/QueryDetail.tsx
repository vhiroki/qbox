import { useState, useEffect, useRef } from "react";
import { Trash2, ChevronDown, Pencil, Play, History, X, Copy, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
import { useQueryStore } from "../stores";
import { api } from "../services/api";
import ChatInterface from "./ChatInterface";
import QueryResults from "./QueryResults";
import SQLHistoryModal from "./SQLHistoryModal";
import DataSourcesPanel from "./DataSourcesPanel";

interface QueryDetailProps {
  queryId: string;
  onQueryDeleted: () => void;
}

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

export default function QueryDetail({
  queryId,
  onQueryDeleted,
}: QueryDetailProps) {
  // Zustand stores
  const queries = useQueryStore((state) => state.queries);
  const selectQuery = useQueryStore((state) => state.selectQuery);
  const updateQuerySQL = useQueryStore((state) => state.updateQuerySQL);
  const updateQueryName = useQueryStore((state) => state.updateQueryName);
  const deleteQuery = useQueryStore((state) => state.deleteQuery);
  const loadQuerySelections = useQueryStore((state) => state.loadQuerySelections);
  const querySelections = useQueryStore((state) => state.querySelections);
  const queryError = useQueryStore((state) => state.error);
  const isQueryLoading = useQueryStore((state) => state.isLoading);
  const setQueryError = useQueryStore((state) => state.setError);

  // Query execution state from store
  const getQueryExecutionState = useQueryStore((state) => state.getQueryExecutionState);
  const setQueryResult = useQueryStore((state) => state.setQueryResult);
  const setQueryPagination = useQueryStore((state) => state.setQueryPagination);

  // Local UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [removeSelectionDialogOpen, setRemoveSelectionDialogOpen] = useState(false);
  const [selectionToRemove, setSelectionToRemove] = useState<{
    connectionId: string;
    schemaName: string;
    tableName: string;
    sourceType: string;
    label: string;
  } | null>(null);
  const [newQueryName, setNewQueryName] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [sqlHistoryModalOpen, setSqlHistoryModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isChatPanelCollapsed, setIsChatPanelCollapsed] = useState(false);

  // Monaco Editor ref for keyboard shortcuts
  const editorRef = useRef<any>(null);
  const isExecutingRef = useRef(isExecuting);
  const sqlTextRef = useRef(sqlText);
  const handleExecuteQueryRef = useRef<(() => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isExecutingRef.current = isExecuting;
  }, [isExecuting]);

  useEffect(() => {
    sqlTextRef.current = sqlText;
  }, [sqlText]);

  // Get cached query execution state
  const executionState = getQueryExecutionState(queryId) || {
    result: null,
    error: null,
    currentPage: 1,
    pageSize: 100,
    executedSqlText: null,
  };

  // Derived state
  const query = queries.find((q) => q.id === queryId);
  const selections = querySelections.get(queryId) || [];
  
  // Store file info for displaying view names
  const [fileInfoMap, setFileInfoMap] = useState<Map<string, { name: string; viewName: string }>>(new Map());
  
  // Store connection info for displaying full qualified names
  const [connectionInfoMap, setConnectionInfoMap] = useState<Map<string, { name: string; alias: string }>>(new Map());
  
  // Track which badge was copied (for showing checkmark feedback)
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  useEffect(() => {
    selectQuery(queryId);
    loadQuerySelections(queryId);
  }, [queryId, selectQuery, loadQuerySelections]);

  // Load file info for file selections to get view names
  useEffect(() => {
    // Don't run if query doesn't exist (e.g., after deletion)
    if (!query) return;

    const loadFileInfo = async () => {
      const fileSelections = selections.filter((s) => s.source_type === "file");
      if (fileSelections.length === 0) {
        setFileInfoMap(new Map());
        return;
      }

      const newFileInfoMap = new Map<string, { name: string; viewName: string }>();
      
      for (const selection of fileSelections) {
        try {
          const fileInfo = await api.getFile(selection.connection_id);
          // Fetch the metadata to get view_name
          const fileMetadata = await api.getFileMetadata(selection.connection_id);
          newFileInfoMap.set(selection.connection_id, {
            name: fileInfo.name,
            viewName: fileMetadata.view_name,
          });
        } catch (err) {
          console.error(`Failed to load file info for ${selection.connection_id}:`, err);
        }
      }
      
      setFileInfoMap(newFileInfoMap);
    };

    loadFileInfo();
  }, [query, selections]);

  // Load connection info for database selections to get aliases
  useEffect(() => {
    // Don't run if query doesn't exist (e.g., after deletion)
    if (!query) return;

    const loadConnectionInfo = async () => {
      const connectionSelections = selections.filter((s) => s.source_type === "connection");
      if (connectionSelections.length === 0) {
        setConnectionInfoMap(new Map());
        return;
      }

      const newConnectionInfoMap = new Map<string, { name: string; alias: string }>();
      
      // Get unique connection IDs
      const uniqueConnectionIds = [...new Set(connectionSelections.map((s) => s.connection_id))];
      
      for (const connectionId of uniqueConnectionIds) {
        try {
          const connectionInfo = await api.getSavedConnection(connectionId);
          newConnectionInfoMap.set(connectionId, {
            name: connectionInfo.name,
            alias: connectionInfo.alias || connectionInfo.name,
          });
        } catch (err) {
          console.error(`Failed to load connection info for ${connectionId}:`, err);
        }
      }
      
      setConnectionInfoMap(newConnectionInfoMap);
    };

    loadConnectionInfo();
  }, [query, selections]);

  useEffect(() => {
    if (query) {
      setSqlText(query.sql_text);
    }
  }, [query?.sql_text]);

  // Auto-save SQL with debouncing (1 second after user stops typing)
  useEffect(() => {
    if (!query || sqlText === query.sql_text) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await updateQuerySQL(query.id, sqlText);
      } catch (err: any) {
        // Error is already set in store
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [sqlText, query, updateQuerySQL]);

  const handleCopyToClipboard = async (label: string, badgeKey: string) => {
    try {
      await navigator.clipboard.writeText(label);
      setCopiedBadge(badgeKey);
      // Reset after 2 seconds
      setTimeout(() => setCopiedBadge(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const handleSelectionChange = async (
    connectionId: string,
    schemaName: string,
    tableName: string,
    checked: boolean,
    sourceType: string
  ) => {
    try {
      if (checked) {
        // Add table
        await api.addQuerySelection(queryId, {
          connection_id: connectionId,
          schema_name: schemaName,
          table_name: tableName,
          source_type: sourceType,
        });
      } else {
        // Remove table
        await api.removeQuerySelection(queryId, {
          connection_id: connectionId,
          schema_name: schemaName,
          table_name: tableName,
          source_type: sourceType,
        });
      }
      // Reload selections after change
      await loadQuerySelections(queryId);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to update table selection";
      setQueryError(errorMsg);
    }
  };

  const handleRemoveSelectionClick = (
    connectionId: string,
    schemaName: string,
    tableName: string,
    sourceType: string,
    label: string
  ) => {
    setSelectionToRemove({
      connectionId,
      schemaName,
      tableName,
      sourceType,
      label,
    });
    setRemoveSelectionDialogOpen(true);
  };

  const handleConfirmRemoveSelection = async () => {
    if (!selectionToRemove) return;

    await handleSelectionChange(
      selectionToRemove.connectionId,
      selectionToRemove.schemaName,
      selectionToRemove.tableName,
      false,
      selectionToRemove.sourceType
    );

    setRemoveSelectionDialogOpen(false);
    setSelectionToRemove(null);
  };

  const handleFileDeleted = async (fileId: string) => {
    // Remove file from query selections
    // Find the file in selections to get its schema_name and table_name
    const fileSelection = selections.find(
      (s) => s.source_type === "file" && s.connection_id === fileId
    );
    if (fileSelection) {
      await handleSelectionChange(
        fileId,
        fileSelection.schema_name,
        fileSelection.table_name,
        false,
        "file"
      );
    }
  };

  const handleDeleteQuery = async () => {
    try {
      await deleteQuery(queryId);
      setDeleteDialogOpen(false);
      onQueryDeleted();
    } catch (err: any) {
      // Error is already set in store
    }
  };

  const handleRenameQuery = async () => {
    if (!newQueryName.trim()) {
      setQueryError("Query name cannot be empty");
      return;
    }

    try {
      await updateQueryName(queryId, newQueryName.trim());
      setRenameDialogOpen(false);
      setNewQueryName("");
    } catch (err: any) {
      // Error is already set in store
    }
  };


  const handleSQLChange = (value: string | undefined) => {
    const newValue = value || "";
    setSqlText(newValue);
  };

  const handleExecuteQuery = async () => {
    if (!query || !sqlTextRef.current.trim()) {
      setQueryResult(queryId, null, "Query SQL is empty");
      return;
    }

    setIsExecuting(true);
    const sqlToExecute = sqlTextRef.current;

    try {
      const result = await api.executeQuery(queryId, {
        page: executionState.currentPage,
        page_size: executionState.pageSize,
        sql_text: sqlToExecute, // Execute current editor content
      });

      if (result.success) {
        setQueryResult(queryId, result, null, sqlToExecute); // Store the SQL that generated these results
      } else {
        setQueryResult(queryId, result, result.error || "Failed to execute query", sqlToExecute);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to execute query";
      setQueryResult(queryId, null, errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  // Store the latest handleExecuteQuery in ref for keyboard shortcut
  useEffect(() => {
    handleExecuteQueryRef.current = handleExecuteQuery;
  });

  const handlePageChange = async (newPage: number) => {
    setQueryPagination(queryId, newPage, executionState.pageSize);
    setIsExecuting(true);

    // Use the stored SQL that generated the current results, not the current editor content
    const sqlToExecute = executionState.executedSqlText || sqlTextRef.current;

    try {
      const result = await api.executeQuery(queryId, {
        page: newPage,
        page_size: executionState.pageSize,
        sql_text: sqlToExecute,
      });

      if (result.success) {
        setQueryResult(queryId, result, null); // Don't update executedSqlText for pagination
      } else {
        setQueryResult(queryId, result, result.error || "Failed to execute query");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to execute query";
      setQueryResult(queryId, null, errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handlePageSizeChange = async (newPageSize: number) => {
    setQueryPagination(queryId, 1, newPageSize); // Reset to first page
    setIsExecuting(true);

    // Use the stored SQL that generated the current results, not the current editor content
    const sqlToExecute = executionState.executedSqlText || sqlTextRef.current;

    try {
      const result = await api.executeQuery(queryId, {
        page: 1,
        page_size: newPageSize,
        sql_text: sqlToExecute,
      });

      if (result.success) {
        setQueryResult(queryId, result, null); // Don't update executedSqlText for pagination
      } else {
        setQueryResult(queryId, result, result.error || "Failed to execute query");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to execute query";
      setQueryResult(queryId, null, errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportToCSV = async () => {
    if (!query) return;

    setIsExporting(true);
    try {
      const blob = await api.exportQueryToCSV(queryId, {
        sql_text: sqlTextRef.current, // Export current editor content
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${query.name.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to export query";
      setQueryResult(queryId, executionState.result, errorMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcut: Cmd/Ctrl + Enter to run query
    editor.addAction({
      id: "execute-query",
      label: "Run Query",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1.5,
      run: () => {
        // Use refs to get current values and function instead of captured closure values
        if (!isExecutingRef.current && sqlTextRef.current.trim() && handleExecuteQueryRef.current) {
          handleExecuteQueryRef.current();
        }
      },
    });
  };

  // Early return if query doesn't exist - prevents infinite loops and errors after deletion
  if (!query) {
    if (isQueryLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-muted-foreground">Loading query...</div>
        </div>
      );
    }
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

        {queryError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{queryError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4 relative">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Tabs for SQL and Tables */}
          <ResizablePanel defaultSize={isChatPanelCollapsed ? 100 : 65} minSize={40}>
            <div className="h-full pr-3">
              <Tabs defaultValue="sql" className="h-full flex flex-col">
                <TabsList className="w-full justify-start mb-4 flex-shrink-0">
                  <TabsTrigger value="sql">SQL Query</TabsTrigger>
                  <TabsTrigger value="tables">
                    Tables ({selections.length})
                  </TabsTrigger>
                </TabsList>

                {/* SQL Query Tab */}
                <TabsContent value="sql" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden">
                  <ResizablePanelGroup direction="vertical" className="h-full">
                    {/* SQL Editor Panel */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <div className="h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                          <Button
                            onClick={handleExecuteQuery}
                            size="sm"
                            disabled={isExecuting || !sqlText.trim()}
                          >
                            <Play className="h-3 w-3 mr-2" />
                            Run Query
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {window.navigator.platform.match("Mac") ? "⌘" : "Ctrl"}+Enter
                          </span>
                          <div className="flex-1" />
                          <Button
                            onClick={() => setSqlHistoryModalOpen(true)}
                            size="sm"
                            variant="outline"
                          >
                            <History className="h-3 w-3 mr-2" />
                            History
                          </Button>
                        </div>
                        <div className="flex-1 border rounded-md overflow-hidden">
                          <Editor
                            defaultLanguage="sql"
                            value={sqlText}
                            onChange={handleSQLChange}
                            onMount={handleEditorDidMount}
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
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Query Results Panel */}
                    <ResizablePanel defaultSize={50} minSize={20}>
                      <div className="h-full pt-2">
                        <QueryResults
                          result={executionState.result}
                          isLoading={isExecuting}
                          error={executionState.error}
                          onPageChange={handlePageChange}
                          onPageSizeChange={handlePageSizeChange}
                          onExport={handleExportToCSV}
                          isExporting={isExporting}
                        />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </TabsContent>

                {/* Tables Tab - Tree View */}
                <TabsContent value="tables" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden">
                  <div className="h-full flex flex-col overflow-hidden">
                    <div className="mb-3 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          {selections.length} {selections.length === 1 ? "table" : "tables"} selected
                        </h3>
                      </div>
                      {selections.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selections.map((selection) => {
                            let label: string;
                            if (selection.source_type === "file") {
                              const fileInfo = fileInfoMap.get(selection.connection_id);
                              label = fileInfo?.viewName || selection.table_name;
                            } else if (selection.source_type === "s3") {
                              // Use S3 view name instead of full path
                              label = getS3ViewName(selection.table_name);
                            } else {
                              // Database connection - use DuckDB alias format: pg_{sanitized_alias}
                              const connectionInfo = connectionInfoMap.get(selection.connection_id);
                              const alias = connectionInfo?.alias || selection.connection_id;
                              const duckdbAlias = `pg_${alias.replace(/-/g, '_')}`;
                              label = `${duckdbAlias}.${selection.schema_name}.${selection.table_name}`;
                            }
                            
                            const badgeKey = `${selection.source_type}-${selection.connection_id}-${selection.schema_name}-${selection.table_name}`;
                            const isCopied = copiedBadge === badgeKey;
                            
                            return (
                              <Badge
                                key={badgeKey}
                                variant="secondary"
                                className="pl-2 pr-1 py-0.5 text-xs gap-1"
                              >
                                <span className="truncate max-w-[400px]">{label}</span>
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
                                    handleRemoveSelectionClick(
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
                    <div className="flex-1 overflow-hidden">
                      <DataSourcesPanel
                        queryId={queryId}
                        selections={selections}
                        onSelectionChange={handleSelectionChange}
                        onFileDeleted={handleFileDeleted}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          {!isChatPanelCollapsed && (
            <>
              <ResizableHandle withHandle />

              {/* Right Panel - Chat */}
              <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
                <div className="h-full pl-3">
                  <ChatInterface
                    query={query}
                    onSQLChange={(sql) => {
                      setSqlText(sql);
                    }}
                    onCollapse={() => setIsChatPanelCollapsed(true)}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Floating expand button when chat is collapsed */}
        {isChatPanelCollapsed && (
          <Button
            onClick={() => setIsChatPanelCollapsed(false)}
            size="sm"
            className="absolute top-4 right-4 z-10 shadow-lg"
            title="Expand chat panel"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Chat with AI
          </Button>
        )}
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
            <Button onClick={handleRenameQuery} disabled={isQueryLoading || !newQueryName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Query Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Query</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete "{query.name}"?
              </p>
              <p className="font-semibold text-destructive">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All table selections ({selections.length} selected)</li>
                <li>All uploaded files ({selections.filter(s => s.source_type === 'file').length} files)</li>
                <li>Complete chat history</li>
                <li>SQL query history</li>
              </ul>
              <p className="text-sm font-semibold">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuery} 
              disabled={isQueryLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Query
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Table Selection Confirmation Dialog */}
      <AlertDialog open={removeSelectionDialogOpen} onOpenChange={setRemoveSelectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{selectionToRemove?.label}" from this query?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveSelection} disabled={isQueryLoading}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SQL History Modal */}
      <SQLHistoryModal
        queryId={queryId}
        isOpen={sqlHistoryModalOpen}
        onClose={() => setSqlHistoryModalOpen(false)}
        onRestore={(restoredSQL) => {
          setSqlText(restoredSQL);
        }}
      />
    </div>
  );
}
