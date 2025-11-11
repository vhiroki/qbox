import { useState, useEffect } from 'react';
import { ChevronRight, Database, FolderOpen, Table, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnectionStore, useQueryStore } from '../stores';
import type { SavedConnection, ConnectionMetadata, SchemaMetadata } from '../types';

interface AddTablesModalProps {
  open: boolean;
  onClose: () => void;
  queryId: string;
  onTablesAdded: () => void;
}

type Step = 'connection' | 'schema' | 'tables';

export default function AddTablesModal({ open, onClose, queryId, onTablesAdded }: AddTablesModalProps) {
  // Zustand stores
  const connections = useConnectionStore((state) => state.connections);
  const loadConnections = useConnectionStore((state) => state.loadConnections);
  const loadMetadata = useConnectionStore((state) => state.loadMetadata);
  const connectionError = useConnectionStore((state) => state.error);
  const isConnectionLoading = useConnectionStore((state) => state.isLoading);

  const addQuerySelection = useQueryStore((state) => state.addQuerySelection);
  const queryError = useQueryStore((state) => state.error);

  const [step, setStep] = useState<Step>('connection');
  const [error, setError] = useState<string | null>(null);

  // Step 1: Connection selection
  const [selectedConnection, setSelectedConnection] = useState<SavedConnection | null>(null);

  // Step 2: Schema selection
  const [metadata, setMetadata] = useState<ConnectionMetadata | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<SchemaMetadata | null>(null);

  // Step 3: Table selection
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadConnections();
      resetState();
    }
  }, [open, loadConnections]);

  const resetState = () => {
    setStep('connection');
    setSelectedConnection(null);
    setMetadata(null);
    setSelectedSchema(null);
    setSelectedTables(new Set());
    setSearchTerm('');
    setError(null);
  };

  const handleConnectionSelect = async (connection: SavedConnection) => {
    try {
      setError(null);
      setSelectedConnection(connection);

      // Load metadata for this connection
      const meta = await loadMetadata(connection.id);
      setMetadata(meta);
      setStep('schema');
    } catch (err: any) {
      setError(connectionError || 'Failed to load connection metadata');
    }
  };

  const handleSchemaSelect = (schema: SchemaMetadata) => {
    setSelectedSchema(schema);
    setStep('tables');
  };

  const handleTableToggle = (tableName: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleSelectAllTables = () => {
    if (!selectedSchema) return;

    const allTables = selectedSchema.tables.map(t => t.name);
    const allSelected = allTables.every(t => selectedTables.has(t));

    if (allSelected) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(allTables));
    }
  };

  const handleSubmit = async () => {
    if (!selectedConnection || !selectedSchema || selectedTables.size === 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Add each selected table to the query
      for (const tableName of selectedTables) {
        await addQuerySelection(queryId, {
          connection_id: selectedConnection.id,
          schema_name: selectedSchema.name,
          table_name: tableName,
        });
      }

      onTablesAdded();
      onClose();
    } catch (err: any) {
      setError(queryError || 'Failed to add tables');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'tables') {
      setStep('schema');
      setSelectedSchema(null);
      setSelectedTables(new Set());
      setSearchTerm('');
    } else if (step === 'schema') {
      setStep('connection');
      setSelectedConnection(null);
      setMetadata(null);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div className={`flex items-center gap-2 ${step === 'connection' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'connection' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          1
        </div>
        <span className="text-sm">Connection</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center gap-2 ${step === 'schema' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'schema' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          2
        </div>
        <span className="text-sm">Schema</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center gap-2 ${step === 'tables' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'tables' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          3
        </div>
        <span className="text-sm">Tables</span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Tables to Query</DialogTitle>
          <DialogDescription>
            Select a connection, schema, and tables to add to your query.
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-[300px] max-h-[400px] overflow-y-auto">
          {/* Step 1: Connection Selection */}
          {step === 'connection' && (
            <div className="space-y-2">
              {isConnectionLoading && connections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
              )}
              {connections.length === 0 && !isConnectionLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No connections available</p>
                  <p className="text-xs mt-1">Create a connection first</p>
                </div>
              )}
              {connections.map((connection) => (
                <button
                  key={connection.id}
                  onClick={() => handleConnectionSelect(connection)}
                  disabled={isConnectionLoading}
                  className="w-full p-4 border rounded-lg hover:bg-accent text-left transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{connection.name}</div>
                      <div className="text-xs text-muted-foreground">{connection.type}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Schema Selection */}
          {step === 'schema' && metadata && (
            <div className="space-y-2">
              {metadata.schemas.map((schema) => (
                <button
                  key={schema.name}
                  onClick={() => handleSchemaSelect(schema)}
                  disabled={isConnectionLoading}
                  className="w-full p-4 border rounded-lg hover:bg-accent text-left transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">{schema.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {schema.tables.length} {schema.tables.length === 1 ? 'table' : 'tables'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Table Selection */}
          {step === 'tables' && selectedSchema && (
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filter tables based on search */}
              {(() => {
                const filteredTables = selectedSchema.tables.filter(table =>
                  table.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                return (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b">
                      <span className="text-sm font-medium">
                        {selectedTables.size} of {selectedSchema.tables.length} selected
                        {searchTerm && ` • ${filteredTables.length} matching`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllTables}
                      >
                        {selectedSchema.tables.every(t => selectedTables.has(t.name)) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    {filteredTables.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Table className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No tables found matching "{searchTerm}"</p>
                      </div>
                    ) : (
                      filteredTables.map((table) => (
                        <details
                          key={table.name}
                          className="border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <summary className="flex items-center gap-3 p-3 cursor-pointer list-none">
                            <Checkbox
                              id={`table-${table.name}`}
                              checked={selectedTables.has(table.name)}
                              onCheckedChange={() => handleTableToggle(table.name)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 flex items-center gap-3">
                              <Table className="h-4 w-4 text-green-500" />
                              <div>
                                <div className="font-medium">{table.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {table.columns.length} columns
                                  {table.row_count != null && ` • ${table.row_count.toLocaleString()} rows`}
                                </div>
                              </div>
                            </div>
                          </summary>
                          <div className="px-3 pb-3 pt-1 ml-9">
                            <div className="text-xs space-y-1 bg-muted/30 rounded p-2 max-h-40 overflow-y-auto">
                              {table.columns.map((column) => (
                                <div key={column.name} className="flex items-center gap-2 py-0.5">
                                  <span className="font-mono text-muted-foreground">{column.name}</span>
                                  <span className="text-muted-foreground/60">:</span>
                                  <span className="font-mono">{column.type}</span>
                                  {column.is_primary_key && (
                                    <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">PK</span>
                                  )}
                                  {!column.nullable && (
                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-1 rounded">
                                      NOT NULL
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      ))
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          {step !== 'connection' && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {step === 'tables' && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedTables.size === 0}
            >
              Add {selectedTables.size} {selectedTables.size === 1 ? 'Table' : 'Tables'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
