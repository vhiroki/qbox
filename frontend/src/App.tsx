import { useState, useEffect } from 'react';
import { Database, FolderKanban } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import WorkspaceSelector from './components/WorkspaceSelector';
import WorkspaceView from './components/WorkspaceView';
import { api } from './services/api';
import type { ConnectionMetadata } from './types';

type Page = 'workspace' | 'connections';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('workspace');
  const [loadedConnections, setLoadedConnections] = useState<Map<string, ConnectionMetadata>>(new Map());
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workspace selections on mount
  useEffect(() => {
    loadWorkspaceSelections();
  }, []);

  const loadWorkspaceSelections = async () => {
    try {
      setLoading(true);
      const data = await api.getWorkspaceSelections();
      
      // Set selected tables
      const tableKeys = new Set(
        data.selections.map(
          (s) => `${s.connection_id}:${s.schema_name}:${s.table_name}`
        )
      );
      setSelectedTables(tableKeys);

      // Get unique connection IDs from selections
      const connectionIds = new Set(data.selections.map(s => s.connection_id));
      
      // Load metadata for each connection
      const connectionsMap = new Map<string, ConnectionMetadata>();
      for (const connectionId of connectionIds) {
        try {
          const metadata = await api.getMetadata(connectionId);
          connectionsMap.set(connectionId, metadata);
        } catch (err: any) {
          console.error(`Failed to load metadata for connection ${connectionId}:`, err);
        }
      }
      
      setLoadedConnections(connectionsMap);
    } catch (err: any) {
      console.error('Failed to load workspace selections:', err);
      setError('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWorkspace = async (connectionId: string, connectionName: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch metadata for this connection
      const metadata = await api.getMetadata(connectionId);
      
      // Add to loaded connections
      setLoadedConnections(prev => new Map(prev).set(connectionId, metadata));
      
      // Switch to workspace page
      setCurrentPage('workspace');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load connection metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleTableToggle = async (connectionId: string, schemaName: string, tableName: string) => {
    const key = `${connectionId}:${schemaName}:${tableName}`;
    const isCurrentlySelected = selectedTables.has(key);

    try {
      if (isCurrentlySelected) {
        // Remove from backend
        await api.removeWorkspaceSelection({
          connection_id: connectionId,
          schema_name: schemaName,
          table_name: tableName,
        });
        
        // Remove from local state
        setSelectedTables(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        // Add to backend
        await api.addWorkspaceSelection({
          connection_id: connectionId,
          schema_name: schemaName,
          table_name: tableName,
        });
        
        // Add to local state
        setSelectedTables(prev => new Set(prev).add(key));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update table selection');
    }
  };

  const handleSchemaToggle = async (connectionId: string, schemaName: string) => {
    const connection = loadedConnections.get(connectionId);
    if (!connection) return;

    const schema = connection.schemas.find(s => s.name === schemaName);
    if (!schema) return;

    // Check if all tables in schema are selected
    const allSelected = schema.tables.every(table =>
      selectedTables.has(`${connectionId}:${schemaName}:${table.name}`)
    );

    try {
      if (allSelected) {
        // Deselect all tables in schema
        for (const table of schema.tables) {
          await api.removeWorkspaceSelection({
            connection_id: connectionId,
            schema_name: schemaName,
            table_name: table.name,
          });
        }
        
        setSelectedTables(prev => {
          const next = new Set(prev);
          schema.tables.forEach(table => {
            next.delete(`${connectionId}:${schemaName}:${table.name}`);
          });
          return next;
        });
      } else {
        // Select all tables in schema
        for (const table of schema.tables) {
          await api.addWorkspaceSelection({
            connection_id: connectionId,
            schema_name: schemaName,
            table_name: table.name,
          });
        }
        
        setSelectedTables(prev => {
          const next = new Set(prev);
          schema.tables.forEach(table => {
            next.add(`${connectionId}:${schemaName}:${table.name}`);
          });
          return next;
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update schema selection');
    }
  };

  const handleExportMetadata = async () => {
    try {
      const data = await api.exportWorkspaceMetadata();
      
      // Create and download file
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-metadata-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to export metadata');
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground dark">
        {/* Left Sidebar Navigation */}
        <div className="w-64 border-r bg-muted/10 flex flex-col">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold">QBox</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Data Query Application
            </p>
          </div>

          <nav className="flex-1 p-4">
            <button
              onClick={() => setCurrentPage('workspace')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                currentPage === 'workspace'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              <FolderKanban className="h-5 w-5" />
              <span className="font-medium">Workspace</span>
            </button>

            <button
              onClick={() => setCurrentPage('connections')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === 'connections'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              <Database className="h-5 w-5" />
              <span className="font-medium">Connections</span>
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <header className="border-b px-6 py-4">
            <h2 className="text-xl font-semibold">
              {currentPage === 'workspace' ? 'Workspace' : 'Manage Connections'}
            </h2>
          </header>

          <main className="flex-1 overflow-auto">
            {currentPage === 'workspace' && (
              <div className="h-full flex">
                {/* Left Panel: Table Selector */}
                <div className="w-80 border-r overflow-hidden flex flex-col">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">Data Sources</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select tables to add to workspace
                    </p>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <WorkspaceSelector
                      connections={loadedConnections}
                      selectedTables={selectedTables}
                      onTableToggle={handleTableToggle}
                      onSchemaToggle={handleSchemaToggle}
                    />
                  </div>
                </div>

                {/* Right Panel: Selected Tables View */}
                <div className="flex-1 overflow-hidden">
                  {loadedConnections.size === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <FolderKanban className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">Workspace is empty</h3>
                        <p className="mb-4">Add data sources and select tables to get started</p>
                        <button
                          onClick={() => setCurrentPage('connections')}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                        >
                          Manage Connections
                        </button>
                      </div>
                    </div>
                  ) : (
                    <WorkspaceView
                      connections={loadedConnections}
                      selectedTables={selectedTables}
                      onExport={handleExportMetadata}
                    />
                  )}
                </div>
              </div>
            )}

            {currentPage === 'connections' && (
              <div className="p-6">
                <ConnectionManager
                  onConnect={handleAddToWorkspace}
                  onDisconnect={() => {}}
                  currentConnectionId={null}
                />
              </div>
            )}
          </main>
        </div>
    </div>
  );
}

export default App;
