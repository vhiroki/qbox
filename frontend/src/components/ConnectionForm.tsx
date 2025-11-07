import { useState, useEffect } from 'react';
import type { PostgresConfig, ConnectionStatus, SavedConnection } from '../types';
import { api } from '../services/api';

interface ConnectionFormProps {
  onConnectionSuccess: (connectionId: string, connectionName: string) => void;
}

export default function ConnectionForm({ onConnectionSuccess }: ConnectionFormProps) {
  const [formData, setFormData] = useState<PostgresConfig>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
  });
  const [connectionName, setConnectionName] = useState('');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveConnection, setSaveConnection] = useState(true);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedConnection, setSelectedSavedConnection] = useState<string>('');

  // Load saved connections on mount
  useEffect(() => {
    loadSavedConnections();
  }, []);

  const loadSavedConnections = async () => {
    try {
      const connections = await api.listSavedConnections();
      setSavedConnections(connections);
    } catch (error) {
      console.error('Failed to load saved connections:', error);
    }
  };

  const handleLoadSavedConnection = async (connectionId: string) => {
    if (!connectionId) {
      setSelectedSavedConnection('');
      return;
    }

    setSelectedSavedConnection(connectionId);

    // Try to reconnect
    setLoading(true);
    setStatus(null);
    try {
      const result = await api.reconnectConnection(connectionId);
      setStatus(result);
      if (result.success && result.connection_id) {
        const conn = savedConnections.find(c => c.id === connectionId);
        onConnectionSuccess(result.connection_id, conn?.name || 'Unknown');
      }
    } catch (error: any) {
      setStatus({
        success: false,
        message: error.response?.data?.detail || 'Failed to reconnect. Please enter password.',
      });
      // Load the connection config for manual password entry
      // Note: We'll need to fetch the config - for now just show the form
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const result = await api.createConnection({
        name: connectionName,
        type: 'postgres',
        config: formData,
      });
      setStatus(result);
      if (result.success && result.connection_id) {
        // Refresh saved connections list
        await loadSavedConnections();

        // Notify parent component
        onConnectionSuccess(result.connection_id, connectionName);

        // Reset form on success
        setConnectionName('');
        setFormData({
          host: 'localhost',
          port: 5432,
          database: '',
          username: '',
          password: '',
          schema: 'public',
        });
        setSelectedSavedConnection('');
      }
    } catch (error: any) {
      setStatus({
        success: false,
        message: error.response?.data?.detail || 'Failed to connect',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Connect to PostgreSQL</h2>

      {savedConnections.length > 0 && (
        <div style={styles.savedConnectionsSection}>
          <label style={styles.label}>Load Saved Connection</label>
          <select
            value={selectedSavedConnection}
            onChange={(e) => handleLoadSavedConnection(e.target.value)}
            style={styles.select}
          >
            <option value="">-- Select a saved connection --</option>
            {savedConnections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} (ID: {conn.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Connection Name</label>
          <input
            type="text"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            required
            style={styles.input}
            placeholder="My Database"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Host</label>
          <input
            type="text"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Port</label>
          <input
            type="number"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Database</label>
          <input
            type="text"
            value={formData.database}
            onChange={(e) => setFormData({ ...formData, database: e.target.value })}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Schema</label>
          <input
            type="text"
            value={formData.schema}
            onChange={(e) => setFormData({ ...formData, schema: e.target.value })}
            style={styles.input}
          />
        </div>

        <div style={styles.checkboxGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={saveConnection}
              onChange={(e) => setSaveConnection(e.target.checked)}
              style={styles.checkbox}
            />
            Save connection details (password not saved)
          </label>
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      {status && (
        <div style={status.success ? styles.successMessage : styles.errorMessage}>
          {status.message}
          {status.connection_id && <div style={styles.connectionId}>ID: {status.connection_id}</div>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333',
  },
  savedConnectionsSection: {
    marginBottom: '30px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginTop: '5px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '5px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#555',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  successMessage: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '4px',
  },
  errorMessage: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
  },
  connectionId: {
    fontSize: '12px',
    marginTop: '5px',
    fontFamily: 'monospace',
  },
};
