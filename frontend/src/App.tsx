import { useState } from 'react';
import { Database, FileCode } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import QueryList from './components/QueryList';
import QueryDetail from './components/QueryDetail';
import AddTablesModal from './components/AddTablesModal';

type Page = 'queries' | 'connections';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('queries');
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [addTablesModalOpen, setAddTablesModalOpen] = useState(false);
  const [queryListRefresh, setQueryListRefresh] = useState(0);

  const handleSelectQuery = (queryId: string) => {
    setSelectedQueryId(queryId);
  };

  const handleQueryDeleted = () => {
    setSelectedQueryId(null);
    setQueryListRefresh(prev => prev + 1);
  };

  const handleTablesAdded = () => {
    // Trigger refresh by resetting and reselecting the query
    if (selectedQueryId) {
      const id = selectedQueryId;
      setSelectedQueryId(null);
      setTimeout(() => setSelectedQueryId(id), 0);
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
                onClick={() => setCurrentPage('queries')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'queries'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                }`}
              >
                <FileCode className="h-4 w-4" />
                <span className="font-medium">Queries</span>
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
        {currentPage === 'queries' && (
          <div className="flex-1 flex">
            {/* Left Panel: Query List */}
            <div className="w-80 border-r flex flex-col">
              <QueryList
                selectedQueryId={selectedQueryId}
                onSelectQuery={handleSelectQuery}
                refreshTrigger={queryListRefresh}
              />
            </div>

            {/* Right Panel: Query Detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedQueryId ? (
                <QueryDetail
                  queryId={selectedQueryId}
                  onQueryDeleted={handleQueryDeleted}
                  onAddTables={() => setAddTablesModalOpen(true)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Select a query</h3>
                    <p className="text-sm">Choose a query from the list or create a new one</p>
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
      {selectedQueryId && (
        <AddTablesModal
          open={addTablesModalOpen}
          onClose={() => setAddTablesModalOpen(false)}
          workspaceId={selectedQueryId}
          onTablesAdded={handleTablesAdded}
        />
      )}
    </div>
  );
}

export default App;
