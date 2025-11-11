import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';
import type { Query, QueryTableSelection, ChatMessage } from '../types';

interface QueryState {
  // Data
  queries: Query[];
  selectedQueryId: string | null;
  querySelections: Map<string, QueryTableSelection[]>; // queryId -> selections
  queryChatHistory: Map<string, ChatMessage[]>; // queryId -> messages

  // Loading & Error states
  isLoading: boolean;
  error: string | null;

  // Actions
  loadQueries: () => Promise<void>;
  selectQuery: (id: string | null) => void;
  createQuery: (name: string) => Promise<Query>;
  updateQuerySQL: (queryId: string, sqlText: string) => Promise<void>;
  updateQueryName: (queryId: string, name: string) => Promise<void>;
  deleteQuery: (queryId: string) => Promise<void>;

  // Selections
  loadQuerySelections: (queryId: string) => Promise<void>;
  addQuerySelection: (queryId: string, selection: Omit<QueryTableSelection, 'query_id'>) => Promise<void>;
  removeQuerySelection: (queryId: string, selection: Omit<QueryTableSelection, 'query_id'>) => Promise<void>;

  // Chat
  loadChatHistory: (queryId: string) => Promise<void>;
  sendChatMessage: (queryId: string, message: string) => Promise<{ updatedSQL: string }>;
  clearChatHistory: (queryId: string) => Promise<void>;

  // Utility
  setError: (error: string | null) => void;
  clearError: () => void;
  getSelectedQuery: () => Query | undefined;
}

export const useQueryStore = create<QueryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      queries: [],
      selectedQueryId: null,
      querySelections: new Map(),
      queryChatHistory: new Map(),
      isLoading: false,
      error: null,

      // Load all queries
      loadQueries: async () => {
        set({ isLoading: true, error: null });
        try {
          const queries = await api.listQueries();
          set({ queries, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load queries',
            isLoading: false
          });
        }
      },

      // Select a query
      selectQuery: (id) => {
        set({ selectedQueryId: id });
      },

      // Create a new query
      createQuery: async (name) => {
        set({ isLoading: true, error: null });
        try {
          const newQuery = await api.createQuery({ name: name.trim() });
          set((state) => ({
            queries: [newQuery, ...state.queries],
            selectedQueryId: newQuery.id,
            isLoading: false,
          }));
          return newQuery;
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to create query',
            isLoading: false
          });
          throw error;
        }
      },

      // Update query SQL
      updateQuerySQL: async (queryId, sqlText) => {
        set({ isLoading: true, error: null });
        try {
          const updatedQuery = await api.updateQuerySQL(queryId, { sql_text: sqlText });
          set((state) => ({
            queries: state.queries.map((q) =>
              q.id === queryId ? updatedQuery : q
            ),
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to update SQL',
            isLoading: false
          });
          throw error;
        }
      },

      // Update query name
      updateQueryName: async (queryId, name) => {
        set({ isLoading: true, error: null });
        try {
          const updatedQuery = await api.updateQueryName(queryId, name.trim());
          set((state) => ({
            queries: state.queries.map((q) =>
              q.id === queryId ? updatedQuery : q
            ),
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to rename query',
            isLoading: false
          });
          throw error;
        }
      },

      // Delete a query
      deleteQuery: async (queryId) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteQuery(queryId);
          const { querySelections, queryChatHistory } = get();

          // Clean up related data
          querySelections.delete(queryId);
          queryChatHistory.delete(queryId);

          set((state) => ({
            queries: state.queries.filter((q) => q.id !== queryId),
            selectedQueryId: state.selectedQueryId === queryId ? null : state.selectedQueryId,
            querySelections: new Map(querySelections),
            queryChatHistory: new Map(queryChatHistory),
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to delete query',
            isLoading: false
          });
          throw error;
        }
      },

      // Load query selections
      loadQuerySelections: async (queryId) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.getQuerySelections(queryId);
          const { querySelections } = get();
          querySelections.set(queryId, data.selections);

          set({
            querySelections: new Map(querySelections),
            isLoading: false
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to load selections',
            isLoading: false
          });
        }
      },

      // Add query selection
      addQuerySelection: async (queryId, selection) => {
        set({ error: null });
        try {
          await api.addQuerySelection(queryId, selection);

          const { querySelections } = get();
          const currentSelections = querySelections.get(queryId) || [];
          querySelections.set(queryId, [...currentSelections, { ...selection, query_id: queryId }]);

          set({ querySelections: new Map(querySelections) });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to add selection' });
          throw error;
        }
      },

      // Remove query selection
      removeQuerySelection: async (queryId, selection) => {
        set({ error: null });
        try {
          await api.removeQuerySelection(queryId, selection);

          const { querySelections } = get();
          const currentSelections = querySelections.get(queryId) || [];
          const updatedSelections = currentSelections.filter(
            (s) =>
              !(
                s.connection_id === selection.connection_id &&
                s.schema_name === selection.schema_name &&
                s.table_name === selection.table_name
              )
          );
          querySelections.set(queryId, updatedSelections);

          set({ querySelections: new Map(querySelections) });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to remove selection' });
          throw error;
        }
      },

      // Load chat history
      loadChatHistory: async (queryId) => {
        set({ error: null });
        try {
          const messages = await api.getChatHistory(queryId);
          const { queryChatHistory } = get();
          queryChatHistory.set(queryId, messages);

          set({ queryChatHistory: new Map(queryChatHistory) });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to load chat history' });
        }
      },

      // Send chat message
      sendChatMessage: async (queryId, message) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.chatWithAI(queryId, { message });

          // Update chat history
          const { queryChatHistory } = get();
          const currentHistory = queryChatHistory.get(queryId) || [];
          queryChatHistory.set(queryId, [...currentHistory, response.message]);

          // Update query SQL
          const updatedQuery = await api.getQuery(queryId);

          set((state) => ({
            queries: state.queries.map((q) => (q.id === queryId ? updatedQuery : q)),
            queryChatHistory: new Map(queryChatHistory),
            isLoading: false,
          }));

          return { updatedSQL: response.updated_sql };
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Failed to send message',
            isLoading: false
          });
          throw error;
        }
      },

      // Clear chat history
      clearChatHistory: async (queryId) => {
        set({ error: null });
        try {
          await api.clearChatHistory(queryId);

          const { queryChatHistory } = get();
          queryChatHistory.set(queryId, []);

          set({ queryChatHistory: new Map(queryChatHistory) });
        } catch (error: any) {
          set({ error: error.response?.data?.detail || 'Failed to clear chat history' });
          throw error;
        }
      },

      // Utility methods
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      getSelectedQuery: () => {
        const { queries, selectedQueryId } = get();
        return queries.find((q) => q.id === selectedQueryId);
      },
    }),
    { name: 'QueryStore' }
  )
);

