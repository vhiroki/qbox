import { useState, useEffect } from 'react';
import type { SavedConnection, PostgresConfig, S3Config, ConnectionConfig, ConnectionType } from '../types';
import { api } from '../services/api';
import { useConnectionStore } from '../stores';
import { generateDuckDBIdentifier } from '../utils/identifier';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [createConnectionType, setCreateConnectionType] = useState<ConnectionType>('postgres');
  const [createFormData, setCreateFormData] = useState<PostgresConfig | S3Config>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schemas: 'public',
  });
  const [createConnectionName, setCreateConnectionName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);
  const [editFormData, setEditFormData] = useState<PostgresConfig | S3Config>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schemas: 'public',
  });
  const [editConnectionName, setEditConnectionName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState<SavedConnection | null>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<ConnectionType | "all">("all");

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Helper function to get connection type prefix
  const getTypePrefix = (type: string): string => {
    const prefixMap: Record<string, string> = {
      postgres: "pg",
      s3: "s3",
      mysql: "mysql",
      oracle: "oracle",
      dynamodb: "dynamodb",
    };
    return prefixMap[type] || "db";
  };

  // Helper function to get connection type badge variant
  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      postgres: "default",
      s3: "secondary",
      mysql: "outline",
      oracle: "outline",
      dynamodb: "outline",
    };
    return variantMap[type] || "outline";
  };

  // Filter connections by type
  const filteredConnections = typeFilter === "all"
    ? connections
    : connections.filter(conn => conn.type === typeFilter);

  const handleCreate = () => {
    setCreateConnectionName('');
    setCreateConnectionType('postgres');
    setCreateFormData({
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      schemas: 'public',
    });
    setCreateError(null);
    setCreateDialogOpen(true);
  };

  const handleConnectionTypeChange = (type: ConnectionType) => {
    setCreateConnectionType(type);
    setCreateError(null);
    
    // Reset form data based on type
    if (type === 'postgres') {
      setCreateFormData({
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: '',
        schemas: 'public',
      });
    } else if (type === 's3') {
      setCreateFormData({
        bucket: '',
        credential_type: 'default',
        region: 'us-east-1',
      });
    }
  };

  const handleCreateSubmit = async () => {
    setCreateError(null);
    try {
      const config: ConnectionConfig = {
        name: createConnectionName,
        type: createConnectionType,
        config: createFormData,
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
      
      // Set form data based on connection type
      if (fullConfig.type === 'postgres') {
        // Handle schemas: can be array (new format) or string (legacy format)
        let schemasValue = '';
        if (Array.isArray(fullConfig.config.schemas)) {
          schemasValue = fullConfig.config.schemas.join(', ');
        } else if (fullConfig.config.schemas) {
          schemasValue = fullConfig.config.schemas;
        } else if (fullConfig.config.schema) {
          // Legacy single schema field
          schemasValue = fullConfig.config.schema;
        }
        
        setEditFormData({
          host: fullConfig.config.host || 'localhost',
          port: fullConfig.config.port || 5432,
          database: fullConfig.config.database || '',
          username: fullConfig.config.username || '',
          password: '', // Don't populate password
          schemas: schemasValue,
        });
      } else if (fullConfig.type === 's3') {
        setEditFormData({
          bucket: fullConfig.config.bucket || '',
          credential_type: fullConfig.config.credential_type || 'default',
          endpoint_url: fullConfig.config.endpoint_url || '', // Preserve endpoint URL
          aws_access_key_id: '', // Don't populate credentials
          aws_secret_access_key: '', // Don't populate credentials
          aws_session_token: '', // Don't populate credentials
          region: fullConfig.config.region || 'us-east-1',
        });
      }
      
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
        type: editingConnection.type as ConnectionType,
        config: editFormData,
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
          {/* Type filter */}
          {connections.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <label htmlFor="type-filter" className="text-sm font-medium">
                Filter by type:
              </label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ConnectionType | "all")}>
                <SelectTrigger id="type-filter" className="w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="postgres">PostgreSQL</SelectItem>
                  <SelectItem value="s3">AWS S3</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="oracle">Oracle</SelectItem>
                  <SelectItem value="dynamodb">DynamoDB</SelectItem>
                </SelectContent>
              </Select>
              {typeFilter !== "all" && (
                <span className="text-sm text-muted-foreground">
                  ({filteredConnections.length} of {connections.length})
                </span>
              )}
            </div>
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
          ) : filteredConnections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No connections of type "{typeFilter}"
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SQL Identifier</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell className="font-medium">{connection.name}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(connection.type)}>
                        {connection.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {generateDuckDBIdentifier(connection.name)}
                      </code>
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update the connection details. Leave sensitive fields blank to keep existing values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <ConnectionFormFields
              connectionType={editingConnection?.type as ConnectionType}
              connectionName={editConnectionName}
              formData={editFormData}
              onNameChange={setEditConnectionName}
              onFormDataChange={(updates) => setEditFormData({ ...editFormData, ...updates })}
              showPasswordPlaceholder={true}
              typeReadOnly={true}
            />

            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create New Connection</DialogTitle>
            <DialogDescription>
              Configure a new data source connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <ConnectionFormFields
              connectionType={createConnectionType}
              connectionName={createConnectionName}
              formData={createFormData}
              onTypeChange={handleConnectionTypeChange}
              onNameChange={setCreateConnectionName}
              onFormDataChange={(updates) => setCreateFormData({ ...createFormData, ...updates })}
            />

            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
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
