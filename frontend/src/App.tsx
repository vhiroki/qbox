import { useState, useEffect } from 'react';
import ConnectionForm from './components/ConnectionForm';
import AIQuery from './components/AIQuery';
import { api } from './services/api';
import './App.css';

function App() {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'connect' | 'query'>('connect');

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

  return (
    <div className="app">
      <header className="header">
        <h1>QBox</h1>
        <p>AI-Powered Data Query Application</p>
        {connectionName && (
          <div style={{ marginTop: '10px', fontSize: '14px', opacity: 0.9 }}>
            Connected to: <strong>{connectionName}</strong>
            <button
              onClick={handleDisconnect}
              style={{
                marginLeft: '10px',
                padding: '5px 10px',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </header>

      <nav className="nav">
        <button
          className={activeTab === 'connect' ? 'active' : ''}
          onClick={() => setActiveTab('connect')}
        >
          Connect
        </button>
        <button
          className={activeTab === 'query' ? 'active' : ''}
          onClick={() => setActiveTab('query')}
        >
          Query
        </button>
      </nav>

      <main className="main">
        {activeTab === 'connect' && (
          <ConnectionForm onConnectionSuccess={handleConnectionSuccess} />
        )}
        {activeTab === 'query' && (
          <AIQuery connectionId={connectionId} />
        )}
      </main>

      <footer className="footer">
        <p>QBox v0.1.0 - Powered by DuckDB & OpenAI</p>
      </footer>
    </div>
  );
}

export default App;
