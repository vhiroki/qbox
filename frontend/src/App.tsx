import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeft, Database, SquarePen, Home } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import ConnectionManager from './components/ConnectionManager';
import QueryList from './components/QueryList';
import QueryDetail from './components/QueryDetail';
import HomePage from './components/HomePage';
import { Button } from './components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/tooltip';
import { useQueryStore } from './stores';

const SIDEBAR_COLLAPSED_KEY = 'qbox-sidebar-collapsed';
const SIDEBAR_LAYOUT_KEY = 'qbox-sidebar-layout';

interface QueryPageProps {
  onCreateQuery: () => void;
  isCreating: boolean;
}

function QueryPage({ onCreateQuery, isCreating }: QueryPageProps) {
  const { queryId } = useParams<{ queryId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if we should focus on rename input
  const shouldFocusRename = searchParams.get('rename') === 'true';

  // Clear the rename param after it's been used
  const handleRenameComplete = () => {
    if (shouldFocusRename) {
      searchParams.delete('rename');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleQueryDeleted = () => {
    navigate('/');
  };

  return (
    <>
      {queryId ? (
        <QueryDetail
          queryId={queryId}
          onQueryDeleted={handleQueryDeleted}
          autoFocusRename={shouldFocusRename}
          onRenameComplete={handleRenameComplete}
        />
      ) : (
        <HomePage onCreateQuery={onCreateQuery} isCreating={isCreating} />
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
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname.startsWith('/connections') ? 'connections' : 'queries';
  const selectedQueryId = location.pathname.match(/^\/query\/([^/]+)$/)?.[1] || null;

  // Sidebar collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });

  // Get createQuery from store
  const createQuery = useQueryStore((state) => state.createQuery);
  const [isCreating, setIsCreating] = useState(false);

  // Load saved panel layout
  const savedLayout = localStorage.getItem(SIDEBAR_LAYOUT_KEY);
  const defaultSidebarSize = savedLayout ? JSON.parse(savedLayout)[0] : 18;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Save panel layout on resize
  const handleLayoutChange = (sizes: number[]) => {
    localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(sizes));
  };

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  // Generate a default query name
  const generateDefaultName = () => {
    const now = new Date();
    return `Query ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  // Create query immediately and navigate with rename flag
  const handleCreateQuery = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const newQuery = await createQuery(generateDefaultName());
      // Navigate to the new query with rename=true to focus the name input
      navigate(`/query/${newQuery.id}?rename=true`);
    } catch (err) {
      console.error('Failed to create query:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Toolbar component - used in both collapsed and expanded states
  const Toolbar = ({ collapsed = false }: { collapsed?: boolean }) => {
    if (collapsed) {
      // Collapsed: All icons stacked vertically
      return (
        <div className="flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Expand sidebar</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentPage === 'queries' && !selectedQueryId ? 'default' : 'ghost'}
                size="icon"
                onClick={() => navigate('/')}
                className="h-8 w-8"
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Home</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentPage === 'connections' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => navigate('/connections')}
                className="h-8 w-8"
              >
                <Database className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Connections</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateQuery}
                disabled={isCreating}
                className="h-8 w-8"
              >
                <SquarePen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>New Query</p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    // Expanded: Collapse on left, other icons on right
    return (
      <div className="flex items-center justify-between w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Collapse sidebar</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentPage === 'queries' && !selectedQueryId ? 'default' : 'ghost'}
                size="icon"
                onClick={() => navigate('/')}
                className="h-8 w-8"
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Home</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentPage === 'connections' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => navigate('/connections')}
                className="h-8 w-8"
              >
                <Database className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Connections</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateQuery}
                disabled={isCreating}
                className="h-8 w-8"
              >
                <SquarePen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>New Query</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex bg-background text-foreground">
        {/* Collapsible Left Sidebar */}
        {isCollapsed ? (
          // Collapsed: Just show toolbar icons vertically
          <div className="h-full border-r flex flex-col items-center py-2 px-1 bg-card">
            <Toolbar collapsed />
          </div>
        ) : (
          // Expanded: Resizable panel with content
          <ResizablePanelGroup direction="horizontal" className="flex-1" onLayout={handleLayoutChange}>
            <ResizablePanel defaultSize={defaultSidebarSize} minSize={15} maxSize={35}>
              <div className="h-full border-r flex flex-col bg-card">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-2 border-b">
                  <Toolbar />
                </div>
                <QueryList
                  currentPage={currentPage}
                  selectedQueryId={selectedQueryId}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Main Content Area */}
            <ResizablePanel defaultSize={100 - defaultSidebarSize}>
              <div className="h-full flex flex-col overflow-hidden">
                <Routes>
                  <Route path="/" element={<QueryPage onCreateQuery={handleCreateQuery} isCreating={isCreating} />} />
                  <Route path="/query/:queryId" element={<QueryPage onCreateQuery={handleCreateQuery} isCreating={isCreating} />} />
                  <Route path="/connections" element={<ConnectionsPage />} />
                </Routes>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* When collapsed, main content takes full width */}
        {isCollapsed && (
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <Routes>
              <Route path="/" element={<QueryPage onCreateQuery={handleCreateQuery} isCreating={isCreating} />} />
              <Route path="/query/:queryId" element={<QueryPage onCreateQuery={handleCreateQuery} isCreating={isCreating} />} />
              <Route path="/connections" element={<ConnectionsPage />} />
            </Routes>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="qbox-theme">
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
