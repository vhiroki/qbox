import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { FileCode } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import QueryList from './components/QueryList';
import QueryDetail from './components/QueryDetail';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable';

function QueryPage() {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();

  const handleQueryDeleted = () => {
    navigate('/');
  };

  return (
    <>
      {queryId ? (
        <QueryDetail
          queryId={queryId}
          onQueryDeleted={handleQueryDeleted}
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
  );
}

function ConnectionsPage() {
  return (
    <div className="h-full overflow-auto">
      <div className="p-4">
        <ConnectionManager />
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const currentPage = location.pathname.startsWith('/connections') ? 'connections' : 'queries';

  // Extract queryId from pathname
  const selectedQueryId = location.pathname.match(/^\/query\/([^/]+)$/)?.[1] || null;

  return (
    <div className="h-screen flex bg-background text-foreground dark">
      {/* Permanent Left Sidebar - Query List */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={15} minSize={10} maxSize={60}>
          <div className="h-full border-r flex flex-col">
            <QueryList
              currentPage={currentPage}
              selectedQueryId={selectedQueryId}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area */}
        <ResizablePanel defaultSize={85}>
          <div className="h-full flex flex-col overflow-hidden">
            <Routes>
              <Route path="/" element={<QueryPage />} />
              <Route path="/query/:queryId" element={<QueryPage />} />
              <Route path="/connections" element={<ConnectionsPage />} />
            </Routes>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
