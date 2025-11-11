import { useState, useEffect } from 'react';
import type { SavedConnection, PostgresConfig, ConnectionConfig } from '../types';
import { api } from '../services/api';
import { useConnectionStore } from '../stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function ConnectionManager() {
  // Zustand store
  const connections = useConnectionStore((state) => state.connections);
  const isLoading = useConnectionStore((state) => state.isLoading);
  const error = useConnectionStore((state) => state.error);
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
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState<SavedConnection | null>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleCreate = () => {
    setCreateConnectionName('');
    setCreateFormData({
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      schema: 'public',
    });
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const config: ConnectionConfig = {
        name: createConnectionName,
        type: 'postgres',
        config: createFormData,
      };

      await createConnection(config);
      setCreateDialogOpen(false);
    } catch (err: any) {
      // Error is already set in store
    }
  };

  const handleEdit = async (connection: SavedConnection) => {
    try {
      const fullConfig = await api.getSavedConnection(connection.id);
      
      setEditingConnection(connection);
      setEditConnectionName(fullConfig.name);
      setEditFormData({
        host: fullConfig.config.host || 'localhost',
        port: fullConfig.config.port || 5432,
        database: fullConfig.config.database || '',
        username: fullConfig.config.username || '',
        password: '', // Don't populate password
        schema: fullConfig.config.schema || 'public',
      });
      setEditDialogOpen(true);
    } catch (err: any) {
      // Handle API error locally as this is a pre-edit operation
      console.error('Failed to load connection details:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingConnection) return;

    try {
      const updateConfig: ConnectionConfig = {
        name: editConnectionName,
        type: 'postgres',
        config: editFormData,
      };

      await updateConnection(editingConnection.id, updateConfig);
      
      setEditDialogOpen(false);
      setEditingConnection(null);
    } catch (err: any) {
      // Error is already set in store
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
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
            <div className="space-y-2">
              <Label htmlFor="edit-name">Connection Name</Label>
              <Input
                id="edit-name"
                value={editConnectionName}
                onChange={(e) => setEditConnectionName(e.target.value)}
                placeholder="My Database"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-host">Host</Label>
                <Input
                  id="edit-host"
                  value={editFormData.host}
                  onChange={(e) => setEditFormData({ ...editFormData, host: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-port">Port</Label>
                <Input
                  id="edit-port"
                  type="number"
                  value={editFormData.port}
                  onChange={(e) => setEditFormData({ ...editFormData, port: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-database">Database</Label>
              <Input
                id="edit-database"
                value={editFormData.database}
                onChange={(e) => setEditFormData({ ...editFormData, database: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                placeholder="Leave blank to keep existing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-schema">Schema</Label>
              <Input
                id="edit-schema"
                value={editFormData.schema}
                onChange={(e) => setEditFormData({ ...editFormData, schema: e.target.value })}
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="create-name">Connection Name</Label>
              <Input
                id="create-name"
                value={createConnectionName}
                onChange={(e) => setCreateConnectionName(e.target.value)}
                placeholder="My Database"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-host">Host</Label>
                <Input
                  id="create-host"
                  value={createFormData.host}
                  onChange={(e) => setCreateFormData({ ...createFormData, host: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-port">Port</Label>
                <Input
                  id="create-port"
                  type="number"
                  value={createFormData.port}
                  onChange={(e) => setCreateFormData({ ...createFormData, port: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-database">Database</Label>
              <Input
                id="create-database"
                value={createFormData.database}
                onChange={(e) => setCreateFormData({ ...createFormData, database: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-username">Username</Label>
              <Input
                id="create-username"
                value={createFormData.username}
                onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createFormData.password}
                onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-schema">Schema</Label>
              <Input
                id="create-schema"
                value={createFormData.schema}
                onChange={(e) => setCreateFormData({ ...createFormData, schema: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={isLoading}>
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
            <AlertDialogDescription>
              This will permanently delete the connection "{deletingConnection?.name}".
              This action cannot be undone.
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
