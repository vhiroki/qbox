import { useState, useEffect } from 'react';
import type { SavedConnection, PostgresConfig, ConnectionConfig } from '../types';
import { api } from '../services/api';
import { useConnectionStore } from '../stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConnectionFormFields from './ConnectionFormFields';

export default function ConnectionManager() {
  // Zustand store
  const connections = useConnectionStore((state) => state.connections);
  const isLoading = useConnectionStore((state) => state.isLoading);
  const loadConnections = useConnectionStore((state) => state.loadConnections);
  const createConnection = useConnectionStore((state) => state.createConnection);
  const updateConnection = useConnectionStore((state) => state.updateConnection);
  const deleteConnection = useConnectionStore((state) => state.deleteConnection);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<PostgresConfig>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
  });
  const [createConnectionName, setCreateConnectionName] = useState('');
  const [createConnectionAlias, setCreateConnectionAlias] = useState('');
  const [isCreateAliasValid, setIsCreateAliasValid] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [editFormData, setEditFormData] = useState<PostgresConfig>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
  });
  const [editConnectionName, setEditConnectionName] = useState('');
  const [editConnectionAlias, setEditConnectionAlias] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState<SavedConnection | null>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleCreate = () => {
    setCreateConnectionName('');
    setCreateConnectionAlias('');
    setCreateFormData({
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      schema: 'public',
    });
    setCreateError(null);
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    setCreateError(null);
    try {
      const config: ConnectionConfig = {
        name: createConnectionName,
        type: 'postgres',
        config: createFormData,
        alias: createConnectionAlias || undefined,
      };

      await createConnection(config);
      setCreateDialogOpen(false);
    } catch (err: any) {
      // Show error in dialog instead of global store
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create connection';
      setCreateError(errorMessage);
    }
  };

  const handleEdit = async (connection: SavedConnection) => {
    try {
      const fullConfig = await api.getSavedConnection(connection.id);
      
      setEditingConnection(connection);
      setEditConnectionName(fullConfig.name);
      // Show the alias field (custom or auto-generated indicator)
      setEditConnectionAlias(fullConfig.alias || '(auto-generated)');
      setEditFormData({
        host: fullConfig.config.host || 'localhost',
        port: fullConfig.config.port || 5432,
        database: fullConfig.config.database || '',
        username: fullConfig.config.username || '',
        password: '', // Don't populate password
        schema: fullConfig.config.schema || 'public',
      });
      setEditError(null);
      setEditDialogOpen(true);
    } catch (err: any) {
      // Handle API error locally as this is a pre-edit operation
      console.error('Failed to load connection details:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingConnection) return;

    setEditError(null);
    try {
      const updateConfig: ConnectionConfig = {
        name: editConnectionName,
        type: 'postgres',
        config: editFormData,
        alias: editConnectionAlias || undefined,
      };

      await updateConnection(editingConnection.id, updateConfig);
      
      setEditDialogOpen(false);
      setEditingConnection(null);
    } catch (err: any) {
      // Show error in dialog instead of global store
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update connection';
      setEditError(errorMessage);
    }
  };

  const handleDeleteClick = (connection: SavedConnection) => {
    setDeletingConnection(connection);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingConnection) return;

    try {
      // Delete both active and saved connection
      await deleteConnection(deletingConnection.id, true);

      setDeleteDialogOpen(false);
      setDeletingConnection(null);
    } catch (err: any) {
      // Error is already set in store
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Manager</CardTitle>
              <CardDescription>
                Manage your saved database connections - edit, delete, or reconnect to existing connections
              </CardDescription>
            </div>
            <Button onClick={handleCreate} disabled={isLoading}>
              Create New Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No saved connections yet</p>
              <Button onClick={handleCreate}>
                Create Your First Connection
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell className="font-medium">{connection.name}</TableCell>
                    <TableCell className="capitalize">{connection.type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {connection.alias ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          pg_{connection.alias}
                        </code>
                      ) : (
                        <span className="text-muted-foreground italic">auto</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {connection.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(connection.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(connection.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(connection)}
                          disabled={isLoading}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(connection)}
                          disabled={isLoading}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update the connection details. Leave password blank to keep the existing password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <ConnectionFormFields
              connectionName={editConnectionName}
              connectionAlias={editConnectionAlias}
              formData={editFormData}
              onNameChange={setEditConnectionName}
              onAliasChange={setEditConnectionAlias}
              onFormDataChange={(updates) => setEditFormData({ ...editFormData, ...updates })}
              showPasswordPlaceholder={true}
              aliasReadOnly={true}
            />

            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isLoading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Connection Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Connection</DialogTitle>
            <DialogDescription>
              Configure a new PostgreSQL database connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <ConnectionFormFields
              connectionName={createConnectionName}
              connectionAlias={createConnectionAlias}
              formData={createFormData}
              onNameChange={setCreateConnectionName}
              onAliasChange={setCreateConnectionAlias}
              onFormDataChange={(updates) => setCreateFormData({ ...createFormData, ...updates })}
              onValidationChange={setIsCreateAliasValid}
            />

            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={isLoading || !isCreateAliasValid}>
              Create Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete the connection "{deletingConnection?.name}".
              </p>
              <p className="font-medium">
                This will also remove all table associations using this connection from your queries.
              </p>
              <p className="text-muted-foreground">
                Queries using this connection will not be deleted, but may not work anymore.
              </p>
              <p className="font-medium text-destructive">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
