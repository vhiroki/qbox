import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { SavedConnection, ConnectionConfig, ConnectionMetadata } from '../types';

interface ConnectionState {
  // Data
  connections: SavedConnection[];
  connectionMetadata: Map<string, ConnectionMetadata>; // connectionId -> metadata
  allMetadataCache: ConnectionMetadata[] | null; // Cache for all metadata
  allMetadataLastFetch: number | null; // Timestamp of last fetch
  
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
  loadAllMetadata: (forceRefresh?: boolean) => Promise<ConnectionMetadata[]>;
  
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
      allMetadataCache: null,
      allMetadataLastFetch: null,
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
          // Invalidate all metadata cache
          set({ allMetadataCache: null, allMetadataLastFetch: null });
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
          
          set({ 
            connectionMetadata: new Map(connectionMetadata),
            // Invalidate all metadata cache
            allMetadataCache: null,
            allMetadataLastFetch: null,
          });
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
            // Invalidate all metadata cache
            allMetadataCache: null,
            allMetadataLastFetch: null,
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
          set({ 
            connectionMetadata: new Map(connectionMetadata),
            // Invalidate all metadata cache
            allMetadataCache: null,
            allMetadataLastFetch: null,
          });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to refresh metadata' });
          throw error;
        }
      },
      
      // Load metadata for all connections (with caching)
      loadAllMetadata: async (forceRefresh = false) => {
        const { allMetadataCache, allMetadataLastFetch } = get();
        
        // Return cached if available and less than 5 minutes old
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        if (!forceRefresh && allMetadataCache && allMetadataLastFetch) {
          const age = Date.now() - allMetadataLastFetch;
          if (age < CACHE_DURATION) {
            return allMetadataCache;
          }
        }
        
        set({ error: null });
        try {
          const allMetadata = await api.getAllMetadata();
          
          // Also update individual connection metadata cache
          const { connectionMetadata } = get();
          allMetadata.forEach((metadata) => {
            connectionMetadata.set(metadata.connection_id, metadata);
          });
          
          set({ 
            allMetadataCache: allMetadata,
            allMetadataLastFetch: Date.now(),
            connectionMetadata: new Map(connectionMetadata),
          });
          
          return allMetadata;
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to load metadata' });
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

