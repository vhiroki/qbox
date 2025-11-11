import { useState, useEffect, useRef } from "react";
import { Trash2, ChevronDown, Pencil, Play, History } from "lucide-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
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
  const [newQueryName, setNewQueryName] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [sqlHistoryModalOpen, setSqlHistoryModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  useEffect(() => {
    selectQuery(queryId);
    loadQuerySelections(queryId);
  }, [queryId, selectQuery, loadQuerySelections]);

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

  const handleFileAdded = async (fileId: string, fileName: string) => {
    // Auto-add file to query selections
    await handleSelectionChange(fileId, fileName, fileName, true, "file");
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

  if (isQueryLoading && !query) {
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

        {queryError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{queryError}</AlertDescription>
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
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {selections.length} {selections.length === 1 ? "table" : "tables"} selected
                      </h3>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <DataSourcesPanel
                        selections={selections}
                        onSelectionChange={handleSelectionChange}
                        onFileAdded={handleFileAdded}
                        onFileDeleted={handleFileDeleted}
                      />
                    </div>
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
                onSQLChange={(sql) => {
                  setSqlText(sql);
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
            <Button onClick={handleRenameQuery} disabled={isQueryLoading || !newQueryName.trim()}>
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
            <AlertDialogAction onClick={handleDeleteQuery} disabled={isQueryLoading}>
              Delete
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
