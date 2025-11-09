import { useState } from 'react';
import { Database, FolderKanban } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import WorkspaceList from './components/WorkspaceList';
import WorkspaceDetail from './components/WorkspaceDetail';
import AddTablesModal from './components/AddTablesModal';

type Page = 'workspaces' | 'connections';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('workspaces');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [addTablesModalOpen, setAddTablesModalOpen] = useState(false);
  const [workspaceListRefresh, setWorkspaceListRefresh] = useState(0);

  const handleSelectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
  };

  const handleWorkspaceDeleted = () => {
    setSelectedWorkspaceId(null);
    setWorkspaceListRefresh(prev => prev + 1); // Trigger workspace list refresh
  };

  const handleTablesAdded = () => {
    // Trigger refresh by resetting and reselecting the workspace
    if (selectedWorkspaceId) {
      const id = selectedWorkspaceId;
      setSelectedWorkspaceId(null);
      setTimeout(() => setSelectedWorkspaceId(id), 0);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground dark">
      {/* Top Header Navigation */}
      <header className="border-b bg-muted/10 flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-2xl font-bold">QBox</h1>
              <p className="text-xs text-muted-foreground">Data Query Application</p>
            </div>
            
            <nav className="flex gap-2">
              <button
                onClick={() => setCurrentPage('workspaces')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'workspaces'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                }`}
              >
                <FolderKanban className="h-4 w-4" />
                <span className="font-medium">Workspaces</span>
              </button>

              <button
                onClick={() => setCurrentPage('connections')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'connections'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                }`}
              >
                <Database className="h-4 w-4" />
                <span className="font-medium">Connections</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'workspaces' && (
          <div className="flex-1 flex">
            {/* Left Panel: Workspace List */}
            <div className="w-80 border-r flex flex-col">
              <WorkspaceList
                selectedWorkspaceId={selectedWorkspaceId}
                onSelectWorkspace={handleSelectWorkspace}
                refreshTrigger={workspaceListRefresh}
              />
            </div>

            {/* Right Panel: Workspace Detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedWorkspaceId ? (
                <WorkspaceDetail
                  workspaceId={selectedWorkspaceId}
                  onWorkspaceDeleted={handleWorkspaceDeleted}
                  onAddTables={() => setAddTablesModalOpen(true)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FolderKanban className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Select a workspace</h3>
                    <p className="text-sm">Choose a workspace from the list or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === 'connections' && (
          <div className="h-full overflow-auto">
            <div className="p-6">
              <ConnectionManager />
            </div>
          </div>
        )}
      </main>

      {/* Add Tables Modal */}
      {selectedWorkspaceId && (
        <AddTablesModal
          open={addTablesModalOpen}
          onClose={() => setAddTablesModalOpen(false)}
          workspaceId={selectedWorkspaceId}
          onTablesAdded={handleTablesAdded}
        />
      )}
    </div>
  );
}

export default App;
