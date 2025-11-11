import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { SavedConnection, ConnectionConfig, ConnectionMetadata } from '../types';

interface ConnectionState {
  // Data
  connections: SavedConnection[];
  connectionMetadata: Map<string, ConnectionMetadata>; // connectionId -> metadata
  
  // Loading & Error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConnections: () => Promise<void>;
  createConnection: (config: ConnectionConfig) => Promise<void>;
  updateConnection: (connectionId: string, config: ConnectionConfig) => Promise<void>;
  deleteConnection: (connectionId: string, deleteSaved?: boolean) => Promise<void>;
  
  // Metadata
  loadMetadata: (connectionId: string) => Promise<ConnectionMetadata>;
  refreshMetadata: (connectionId: string) => Promise<void>;
  
  // Utility
  setError: (error: string | null) => void;
  clearError: () => void;
  getConnectionById: (id: string) => SavedConnection | undefined;
  getMetadataById: (id: string) => ConnectionMetadata | undefined;
}

export const useConnectionStore = create<ConnectionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      connections: [],
      connectionMetadata: new Map(),
      isLoading: false,
      error: null,
      
      // Load all connections
      loadConnections: async () => {
        set({ isLoading: true, error: null });
        try {
          const connections = await api.listSavedConnections();
          set({ connections, isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Failed to load connections',
            isLoading: false 
          });
        }
      },
      
      // Create a new connection
      createConnection: async (config) => {
        set({ isLoading: true, error: null });
        try {
          await api.createConnection(config);
          // Reload connections after creation
          await get().loadConnections();
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Failed to create connection',
            isLoading: false 
          });
          throw error;
        }
      },
      
      // Update a connection
      updateConnection: async (connectionId, config) => {
        set({ isLoading: true, error: null });
        try {
          await api.updateSavedConnection(connectionId, config);
          
          // Clear cached metadata for this connection
          const { connectionMetadata } = get();
          connectionMetadata.delete(connectionId);
          
          // Reload connections
          await get().loadConnections();
          
          set({ connectionMetadata: new Map(connectionMetadata) });
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Failed to update connection',
            isLoading: false 
          });
          throw error;
        }
      },
      
      // Delete a connection
      deleteConnection: async (connectionId, deleteSaved = true) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteConnection(connectionId, deleteSaved);
          
          // Clean up cached metadata
          const { connectionMetadata } = get();
          connectionMetadata.delete(connectionId);
          
          set((state) => ({
            connections: state.connections.filter((c) => c.id !== connectionId),
            connectionMetadata: new Map(connectionMetadata),
            isLoading: false,
          }));
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Failed to delete connection',
            isLoading: false 
          });
          throw error;
        }
      },
      
      // Load metadata for a connection
      loadMetadata: async (connectionId) => {
        const { connectionMetadata } = get();
        
        // Return cached if available
        const cached = connectionMetadata.get(connectionId);
        if (cached) {
          return cached;
        }
        
        set({ error: null });
        try {
          const metadata = await api.getMetadata(connectionId);
          connectionMetadata.set(connectionId, metadata);
          set({ connectionMetadata: new Map(connectionMetadata) });
          return metadata;
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to load metadata' });
          throw error;
        }
      },
      
      // Refresh metadata for a connection
      refreshMetadata: async (connectionId) => {
        set({ error: null });
        try {
          const metadata = await api.refreshMetadata(connectionId);
          const { connectionMetadata } = get();
          connectionMetadata.set(connectionId, metadata);
          set({ connectionMetadata: new Map(connectionMetadata) });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to refresh metadata' });
          throw error;
        }
      },
      
      // Utility methods
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      getConnectionById: (id) => {
        return get().connections.find((c) => c.id === id);
      },
      getMetadataById: (id) => {
        return get().connectionMetadata.get(id);
      },
    }),
    { name: 'ConnectionStore' }
  )
);

