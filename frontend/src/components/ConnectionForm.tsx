import { useState, useEffect } from 'react';
import type { PostgresConfig, ConnectionStatus, SavedConnection } from '../types';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import ConnectionFormFields from './ConnectionFormFields';

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
    schemas: '',
  });
  const [connectionName, setConnectionName] = useState('');
  const [connectionAlias, setConnectionAlias] = useState('');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveConnection, setSaveConnection] = useState(true);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedConnection, setSelectedSavedConnection] = useState<string>('');
  const [isAliasValid, setIsAliasValid] = useState(true);

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
        alias: connectionAlias || undefined, // Send undefined if empty
      });
      setStatus(result);
      if (result.success && result.connection_id) {
        // Refresh saved connections list
        await loadSavedConnections();

        // Notify parent component
        onConnectionSuccess(result.connection_id, connectionName);

        // Reset form on success
        setConnectionName('');
        setConnectionAlias('');
        setFormData({
          host: 'localhost',
          port: 5432,
          database: '',
          username: '',
          password: '',
          schemas: '',
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
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Connect to PostgreSQL</CardTitle>
          <CardDescription>Enter your database connection details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {savedConnections.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="saved-connection">Load Saved Connection</Label>
              <Select value={selectedSavedConnection} onValueChange={handleLoadSavedConnection}>
                <SelectTrigger id="saved-connection">
                  <SelectValue placeholder="-- Select a saved connection --" />
                </SelectTrigger>
                <SelectContent>
                  {savedConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name} (ID: {conn.id.substring(0, 8)}...)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <ConnectionFormFields
              connectionName={connectionName}
              connectionAlias={connectionAlias}
              formData={formData}
              onNameChange={setConnectionName}
              onAliasChange={setConnectionAlias}
              onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
              nameRequired={true}
              onValidationChange={setIsAliasValid}
            />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-connection"
                checked={saveConnection}
                onCheckedChange={(checked) => setSaveConnection(checked as boolean)}
              />
              <Label htmlFor="save-connection" className="text-sm font-normal cursor-pointer">
                Save connection details (password not saved)
              </Label>
            </div>

            <Button type="submit" disabled={loading || !isAliasValid} className="w-full">
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </form>

          {status && (
            <Alert variant={status.success ? 'default' : 'destructive'}>
              <AlertDescription>
                {status.message}
                {status.connection_id && (
                  <div className="mt-1 text-xs font-mono">ID: {status.connection_id}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
