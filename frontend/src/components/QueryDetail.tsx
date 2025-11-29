import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, ChevronDown, Pencil, Play, History, PanelRightClose, PanelRight } from "lucide-react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { useQueryStore } from "../stores";
import { api } from "../services/api";
import QueryResults from "./QueryResults";
import SQLHistoryModal from "./SQLHistoryModal";
import RightSidePanel, { type RightSidePanelRef } from "./RightSidePanel";

interface QueryDetailProps {
  queryId: string;
  onQueryDeleted: () => void;
  autoFocusRename?: boolean;
  onRenameComplete?: () => void;
}

const HORIZONTAL_LAYOUT_KEY = 'qbox-query-horizontal-layout';
const VERTICAL_LAYOUT_KEY = 'qbox-query-vertical-layout';

export default function QueryDetail({
  queryId,
  onQueryDeleted,
  autoFocusRename = false,
  onRenameComplete,
}: QueryDetailProps) {
  // Zustand stores
  const queries = useQueryStore((state) => state.queries);
  const selectQuery = useQueryStore((state) => state.selectQuery);
  const updateQuerySQL = useQueryStore((state) => state.updateQuerySQL);
  const updateQueryName = useQueryStore((state) => state.updateQueryName);
  const deleteQuery = useQueryStore((state) => state.deleteQuery);
  const loadQuerySelections = useQueryStore((state) => state.loadQuerySelections);
  const querySelections = useQueryStore((state) => state.querySelections);
  const isQueryLoading = useQueryStore((state) => state.isLoading);
  
  // Local error state for query detail operations (rename, delete, selection changes)
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Theme for Monaco editor
  const { theme } = useTheme();
  const resolvedTheme = theme === "system" 
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  const monacoTheme = resolvedTheme === "dark" ? "qbox-dark" : "qbox-light";

  // Query execution state from store
  const getQueryExecutionState = useQueryStore((state) => state.getQueryExecutionState);
  const setQueryResult = useQueryStore((state) => state.setQueryResult);
  const setQueryPagination = useQueryStore((state) => state.setQueryPagination);

  // Local UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [removeSelectionDialogOpen, setRemoveSelectionDialogOpen] = useState(false);
  const [selectionToRemove, setSelectionToRemove] = useState<{
    connectionId: string;
    schemaName: string;
    tableName: string;
    sourceType: string;
    label: string;
  } | null>(null);
  const [sqlText, setSqlText] = useState("");
  const [sqlHistoryModalOpen, setSqlHistoryModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  // Load saved panel layouts
  const savedHorizontalLayout = localStorage.getItem(HORIZONTAL_LAYOUT_KEY);
  const defaultHorizontalSizes = savedHorizontalLayout ? JSON.parse(savedHorizontalLayout) : [60, 40];
  const savedVerticalLayout = localStorage.getItem(VERTICAL_LAYOUT_KEY);
  const defaultVerticalSizes = savedVerticalLayout ? JSON.parse(savedVerticalLayout) : [60, 40];

  // Save panel layouts on resize
  const handleHorizontalLayoutChange = useCallback((sizes: number[]) => {
    localStorage.setItem(HORIZONTAL_LAYOUT_KEY, JSON.stringify(sizes));
  }, []);

  const handleVerticalLayoutChange = useCallback((sizes: number[]) => {
    localStorage.setItem(VERTICAL_LAYOUT_KEY, JSON.stringify(sizes));
  }, []);

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const isExecutingRef = useRef(isExecuting);
  const sqlTextRef = useRef(sqlText);
  const handleExecuteQueryRef = useRef<(() => void) | null>(null);
  const lastAutoFocusedQueryIdRef = useRef<string | null>(null);
  const rightSidePanelRef = useRef<RightSidePanelRef>(null);
  const loadedSelectionsForQueryRef = useRef<string | null>(null);

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
  const [connectionInfoMap, setConnectionInfoMap] = useState<Map<string, { name: string }>>(new Map());
  
  useEffect(() => {
    setLocalError(null); // Clear local error when switching queries
    selectQuery(queryId);

    // Only load selections if we haven't loaded them for this query yet
    if (loadedSelectionsForQueryRef.current !== queryId) {
      loadedSelectionsForQueryRef.current = queryId;
      loadQuerySelections(queryId);
    }
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

  // Load connection info for database selections to get identifiers
  useEffect(() => {
    // Don't run if query doesn't exist (e.g., after deletion)
    if (!query) return;

    const loadConnectionInfo = async () => {
      const connectionSelections = selections.filter((s) => s.source_type === "connection");
      if (connectionSelections.length === 0) {
        setConnectionInfoMap(new Map());
        return;
      }

      const newConnectionInfoMap = new Map<string, { name: string }>();

      // Get unique connection IDs
      const uniqueConnectionIds = [...new Set(connectionSelections.map((s) => s.connection_id))];

      for (const connectionId of uniqueConnectionIds) {
        try {
          const connectionInfo = await api.getSavedConnection(connectionId);
          newConnectionInfoMap.set(connectionId, {
            name: connectionInfo.name,
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

  // Auto-focus rename input when autoFocusRename is true (after creating a new query)
  useEffect(() => {
    // Only trigger if:
    // 1. autoFocusRename is true (URL has ?rename=true)
    // 2. query is loaded
    // 3. We haven't already auto-focused this specific query
    if (autoFocusRename && query && lastAutoFocusedQueryIdRef.current !== queryId) {
      lastAutoFocusedQueryIdRef.current = queryId;
      setEditedName(query.name);
      setIsEditingName(true);
      // Focus will happen via the other effect when isEditingName becomes true
    }
  }, [autoFocusRename, query, queryId]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName) {
      // Use a small timeout to ensure the input is rendered and ready
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditingName]);

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
      setLocalError(null);
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
      setLocalError(errorMsg);
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

  const startEditing = () => {
    if (query) {
      setEditedName(query.name);
      setIsEditingName(true);
    }
  };

  const cancelEditing = () => {
    setIsEditingName(false);
    setEditedName("");
    onRenameComplete?.();
  };

  const handleRenameQuery = async () => {
    if (!editedName.trim()) {
      // If empty, revert to original name
      cancelEditing();
      return;
    }

    // Only update if name actually changed
    if (query && editedName.trim() !== query.name) {
      try {
        await updateQueryName(queryId, editedName.trim());
      } catch (err: any) {
        // Error is already set in store
      }
    }
    
    setIsEditingName(false);
    setEditedName("");
    onRenameComplete?.();
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameQuery();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
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

  const handleFixWithAI = (error: string) => {
    // Expand right panel if collapsed
    if (isRightPanelCollapsed) {
      setIsRightPanelCollapsed(false);
    }

    // Send error message to chat with helpful context
    const errorMessage = `I'm getting this error when running my query:\n\n${error}\n\nCan you help me fix it?`;
    rightSidePanelRef.current?.sendChatMessage(errorMessage);
  };

  // Define custom themes before the editor mounts
  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Define custom warm dark theme to match our app's aesthetic
    monaco.editor.defineTheme('qbox-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c678dd' },
        { token: 'keyword.sql', foreground: 'c678dd' },
        { token: 'string', foreground: '98c379' },
        { token: 'string.sql', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'comment', foreground: '5c6370' },
        { token: 'operator', foreground: '56b6c2' },
        { token: 'identifier', foreground: 'e5c07b' },
      ],
      colors: {
        'editor.background': '#1b1913',
        'editor.foreground': '#edecec',
        'editor.lineHighlightBackground': '#201e18',
        'editor.selectionBackground': '#3a3830',
        'editor.inactiveSelectionBackground': '#2a2820',
        'editorCursor.foreground': '#f59e0b',
        'editorLineNumber.foreground': '#5c5a52',
        'editorLineNumber.activeForeground': '#a8a7a5',
        'editorIndentGuide.background': '#26241e',
        'editorIndentGuide.activeBackground': '#3a3830',
        'editorGutter.background': '#1b1913',
      },
    });

    // Define custom warm light theme
    monaco.editor.defineTheme('qbox-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'a626a4' },
        { token: 'keyword.sql', foreground: 'a626a4' },
        { token: 'string', foreground: '50a14f' },
        { token: 'string.sql', foreground: '50a14f' },
        { token: 'number', foreground: '986801' },
        { token: 'comment', foreground: 'a0a1a7' },
        { token: 'operator', foreground: '0184bc' },
        { token: 'identifier', foreground: 'c18401' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.foreground': '#0a0a0b',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editor.selectionBackground': '#d0d0d0',
        'editorCursor.foreground': '#b45309',
        'editorLineNumber.foreground': '#a0a1a7',
        'editorLineNumber.activeForeground': '#52525b',
        'editorGutter.background': '#fafafa',
      },
    });
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
      <div className="border-b p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleRenameQuery}
                onKeyDown={handleNameKeyDown}
                className="text-sm font-semibold h-8 py-1 px-2 w-[250px]"
                placeholder="Query name"
                autoFocus
              />
            ) : (
              <>
                <h2 
                  className="text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={startEditing}
                  title="Click to rename"
                >
                  {query.name}
                </h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-muted transition-colors">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={startEditing}>
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
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {localError && (
              <Alert variant="destructive" className="py-1 px-2 text-xs">
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title={isRightPanelCollapsed ? "Show Tables & AI panel" : "Hide Tables & AI panel"}
            >
              {isRightPanelCollapsed ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <ResizablePanelGroup direction="horizontal" className="h-full" onLayout={handleHorizontalLayoutChange}>
          {/* Left Panel - SQL Editor and Results */}
          <ResizablePanel defaultSize={isRightPanelCollapsed ? 100 : defaultHorizontalSizes[0]} minSize={40}>
            <div className="h-full pr-3">
              <ResizablePanelGroup direction="vertical" className="h-full" onLayout={handleVerticalLayoutChange}>
                {/* SQL Editor Panel */}
                <ResizablePanel defaultSize={defaultVerticalSizes[0]} minSize={25}>
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
                        beforeMount={handleEditorWillMount}
                        onMount={handleEditorDidMount}
                        theme={monacoTheme}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
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
                <ResizablePanel defaultSize={defaultVerticalSizes[1]} minSize={20}>
                  <div className="h-full pt-2">
                    <QueryResults
                      result={executionState.result}
                      isLoading={isExecuting}
                      error={executionState.error}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      onExport={handleExportToCSV}
                      isExporting={isExporting}
                      onFixWithAI={handleFixWithAI}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          {!isRightPanelCollapsed && (
            <>
              <ResizableHandle withHandle />

              {/* Right Panel - Tables & AI Chat */}
              <ResizablePanel defaultSize={defaultHorizontalSizes[1]} minSize={25} maxSize={55}>
                <div className="h-full pl-3">
                  <RightSidePanel
                    ref={rightSidePanelRef}
                    query={query}
                    queryId={queryId}
                    selections={selections}
                    onSQLChange={(sql) => setSqlText(sql)}
                    onSelectionChange={handleSelectionChange}
                    onFileDeleted={handleFileDeleted}
                    onRemoveSelection={handleRemoveSelectionClick}
                    fileInfoMap={fileInfoMap}
                    connectionInfoMap={connectionInfoMap}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

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
