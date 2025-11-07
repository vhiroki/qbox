import { useState, useEffect } from 'react';
import ConnectionForm from './components/ConnectionForm';
import ConnectionManager from './components/ConnectionManager';
import AIQuery from './components/AIQuery';
import { api } from './services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'connect' | 'manage' | 'query'>('connect');

  // Load saved connection from localStorage on mount
  useEffect(() => {
    const savedConnectionId = localStorage.getItem('qbox_connection_id');
    const savedConnectionName = localStorage.getItem('qbox_connection_name');
    if (savedConnectionId && savedConnectionName) {
      // Verify the connection is still valid by checking with backend
      api.listConnections()
        .then(connections => {
          const isValid = connections.some(c => c.id === savedConnectionId);
          if (isValid) {
            setConnectionId(savedConnectionId);
            setConnectionName(savedConnectionName);
          } else {
            // Connection no longer valid (backend was restarted)
            localStorage.removeItem('qbox_connection_id');
            localStorage.removeItem('qbox_connection_name');
          }
        })
        .catch(() => {
          // Backend not available, clear saved connection
          localStorage.removeItem('qbox_connection_id');
          localStorage.removeItem('qbox_connection_name');
        });
    }
  }, []);

  const handleConnectionSuccess = (connId: string, connName: string) => {
    setConnectionId(connId);
    setConnectionName(connName);
    // Save to localStorage for persistence
    localStorage.setItem('qbox_connection_id', connId);
    localStorage.setItem('qbox_connection_name', connName);
    // Automatically switch to query tab
    setActiveTab('query');
  };

  const handleDisconnect = () => {
    setConnectionId(null);
    setConnectionName(null);
    localStorage.removeItem('qbox_connection_id');
    localStorage.removeItem('qbox_connection_name');
    setActiveTab('connect');
  };

  const handleConnectionDeleted = (deletedConnectionId: string) => {
    // If the deleted connection is the current one, clear it
    if (connectionId === deletedConnectionId) {
      handleDisconnect();
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <header className="border-b border-border py-8 px-6">
          <div className="container mx-auto">
            <h1 className="text-4xl font-bold mb-2">QBox</h1>
            <p className="text-muted-foreground">AI-Powered Data Query Application</p>
            {connectionName && (
              <div className="mt-4 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  Connected to: <strong>{connectionName}</strong>
                </span>
                <Button
                  onClick={handleDisconnect}
                size="sm"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 container mx-auto py-8 px-4">
          <Tabs defaultValue="connect" value={activeTab} onValueChange={(value) => setActiveTab(value as 'connect' | 'manage' | 'query')} className="w-full">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="query">Query</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connect" className="mt-0">
              <ConnectionForm onConnectionSuccess={handleConnectionSuccess} />
            </TabsContent>
            
            <TabsContent value="manage" className="mt-0">
              <ConnectionManager 
                onConnect={handleConnectionSuccess} 
                onDisconnect={handleConnectionDeleted}
                currentConnectionId={connectionId}
              />
            </TabsContent>
            
            <TabsContent value="query" className="mt-0">
              <AIQuery connectionId={connectionId} />
            </TabsContent>
          </Tabs>
        </main>

        <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
          <p>QBox v0.1.0 - Powered by DuckDB & OpenAI</p>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
