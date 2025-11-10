import { useState } from 'react';
import { FileCode } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import QueryList from './components/QueryList';
import QueryDetail from './components/QueryDetail';
import AddTablesModal from './components/AddTablesModal';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable';

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

  const handleQueryUpdated = () => {
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
    <div className="h-screen flex bg-background text-foreground dark">
      {/* Permanent Left Sidebar - Query List */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={15} minSize={10} maxSize={60}>
          <div className="h-full border-r flex flex-col">
            <QueryList
              selectedQueryId={selectedQueryId}
              onSelectQuery={handleSelectQuery}
              refreshTrigger={queryListRefresh}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area */}
        <ResizablePanel defaultSize={85}>
          <div className="h-full flex flex-col overflow-hidden">
            {currentPage === 'queries' && (
              <>
                {selectedQueryId ? (
                  <QueryDetail
                    queryId={selectedQueryId}
                    onQueryDeleted={handleQueryDeleted}
                    onQueryUpdated={handleQueryUpdated}
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
              </>
            )}

            {currentPage === 'connections' && (
              <div className="h-full overflow-auto">
                <div className="p-4">
                  <ConnectionManager />
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

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
