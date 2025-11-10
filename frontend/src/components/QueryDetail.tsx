import { useState, useEffect } from "react";
import { Plus, Trash2, Database, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "../services/api";
import ChatInterface from "./ChatInterface";
import type {
  Query,
  QueryTableSelection,
  TableMetadata,
} from "../types";

interface QueryDetailProps {
  queryId: string;
  onQueryDeleted: () => void;
  onAddTables: () => void;
}

export default function QueryDetail({
  queryId,
  onQueryDeleted,
  onAddTables,
}: QueryDetailProps) {
  const [query, setQuery] = useState<Query | null>(null);
  const [selections, setSelections] = useState<QueryTableSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Table details dialog
  const [selectedTable, setSelectedTable] = useState<{
    selection: QueryTableSelection;
    metadata: TableMetadata | null;
  } | null>(null);
  const [tableDetailsOpen, setTableDetailsOpen] = useState(false);
  const [loadingTableDetails, setLoadingTableDetails] = useState(false);

  useEffect(() => {
    loadQueryData();
  }, [queryId]);

  const loadQueryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [queryData, selectionsData] = await Promise.all([
        api.getQuery(queryId),
        api.getQuerySelections(queryId),
      ]);

      setQuery(queryData);
      setSelections(selectionsData.selections);
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

  const handleTableClick = async (selection: QueryTableSelection) => {
    try {
      setLoadingTableDetails(true);
      setTableDetailsOpen(true);
      setSelectedTable({ selection, metadata: null });

      // Fetch metadata for the connection
      const metadata = await api.getMetadata(selection.connection_id);

      // Find the specific table
      const schema = metadata.schemas.find(
        (s) => s.name === selection.schema_name
      );
      const table = schema?.tables.find((t) => t.name === selection.table_name);

      setSelectedTable({ selection, metadata: table || null });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load table details");
    } finally {
      setLoadingTableDetails(false);
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

  const handleSQLUpdate = (updatedQuery: Query) => {
    setQuery(updatedQuery);
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
      <div className="border-b bg-muted/10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{query.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selections.length}{" "}
              {selections.length === 1 ? "table" : "tables"} connected
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onAddTables}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tables
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <Tabs defaultValue="chat" className="h-full flex flex-col">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="chat">Chat & SQL</TabsTrigger>
            <TabsTrigger value="tables">
              Connected Tables ({selections.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 overflow-hidden">
            <ChatInterface query={query} onSQLUpdate={handleSQLUpdate} />
          </TabsContent>

          <TabsContent value="tables" className="flex-1 overflow-y-auto">
            {selections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No tables connected yet</p>
                <p className="text-xs mt-1">
                  Click "Add Tables" to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selections.map((selection) => (
                  <div
                    key={`${selection.connection_id}:${selection.schema_name}:${selection.table_name}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg border border-primary/20 group"
                  >
                    <button
                      onClick={() => handleTableClick(selection)}
                      className="flex items-center gap-2 hover:underline"
                      title="View table details"
                    >
                      <Database className="h-3 w-3" />
                      <span className="text-sm font-medium">
                        {selection.schema_name}.{selection.table_name}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTable(selection);
                      }}
                      className="ml-1 hover:bg-primary/20 rounded p-0.5 transition-colors"
                      title="Remove table"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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

      {/* Table Details Dialog */}
      <Dialog open={tableDetailsOpen} onOpenChange={setTableDetailsOpen}>
        <DialogContent className="max-w-6xl min-w-[800px] w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTable?.selection.schema_name}.
              {selectedTable?.selection.table_name}
            </DialogTitle>
            <DialogDescription>
              Table column definitions and metadata
            </DialogDescription>
          </DialogHeader>

          {loadingTableDetails && (
            <div className="py-8 text-center text-muted-foreground">
              Loading table details...
            </div>
          )}

          {!loadingTableDetails && selectedTable?.metadata && (
            <div className="space-y-4">
              {selectedTable.metadata.row_count !== undefined && (
                <div className="text-sm text-muted-foreground">
                  {selectedTable.metadata.row_count.toLocaleString()} rows
                </div>
              )}

              <div className="overflow-x-auto -mx-6 px-6">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%] break-words whitespace-normal">
                        Column Name
                      </TableHead>
                      <TableHead className="w-[35%] break-words whitespace-normal">
                        Type
                      </TableHead>
                      <TableHead className="w-[15%] break-words whitespace-normal">
                        Nullable
                      </TableHead>
                      <TableHead className="w-[15%] break-words whitespace-normal">
                        Primary Key
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTable.metadata.columns.map((column) => (
                      <TableRow key={column.name}>
                        <TableCell className="font-medium break-words whitespace-normal">
                          {column.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all whitespace-normal">
                          {column.type}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              column.nullable
                                ? "text-muted-foreground"
                                : "text-yellow-600"
                            }
                          >
                            {column.nullable ? "Yes" : "No"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {column.is_primary_key && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              PK
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!loadingTableDetails && !selectedTable?.metadata && (
            <div className="py-8 text-center text-muted-foreground">
              Table details not available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
