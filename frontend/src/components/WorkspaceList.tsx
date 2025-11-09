import { useState, useEffect } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '../services/api';
import type { Workspace } from '../types';

interface WorkspaceListProps {
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh
}

export default function WorkspaceList({ selectedWorkspaceId, onSelectWorkspace, refreshTrigger }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, [refreshTrigger]); // Re-run when refreshTrigger changes

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listWorkspaces();
      setWorkspaces(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setWorkspaceName('');
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newWorkspace = await api.createWorkspace({ name: workspaceName.trim() });
      setCreateDialogOpen(false);
      setWorkspaceName('');
      await loadWorkspaces();
      onSelectWorkspace(newWorkspace.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <Button onClick={handleCreate} disabled={loading} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Workspace
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && workspaces.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            Loading workspaces...
          </div>
        )}

        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {!loading && workspaces.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No workspaces yet</p>
            <p className="text-xs mt-1">Create your first workspace to get started</p>
          </div>
        )}

        <div className="p-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.id)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                selectedWorkspaceId === workspace.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              <div className="font-medium truncate">{workspace.name}</div>
              <div className="text-xs opacity-70 mt-1">
                {formatDate(workspace.updated_at)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Give your new workspace a descriptive name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., Customer Analytics"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSubmit();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={loading || !workspaceName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
