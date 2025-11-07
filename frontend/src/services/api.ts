import axios from 'axios';
import type {
  ConnectionConfig,
  ConnectionStatus,
  Connection,
  SavedConnection,
  TableSchema,
  QueryRequest,
  AIQueryRequest,
  QueryResult,
} from '../types';

const API_BASE_URL = '/api';

export const api = {
  // Connection endpoints
  async createConnection(config: ConnectionConfig): Promise<ConnectionStatus> {
    const response = await axios.post(`${API_BASE_URL}/connections/`, config);
    return response.data;
  },

  async listConnections(): Promise<Connection[]> {
    const response = await axios.get(`${API_BASE_URL}/connections/`);
    return response.data.connections;
  },

  async listSavedConnections(): Promise<SavedConnection[]> {
    const response = await axios.get(`${API_BASE_URL}/connections/saved`);
    return response.data.connections;
  },

  async reconnectConnection(connectionId: string): Promise<ConnectionStatus> {
    const response = await axios.post(`${API_BASE_URL}/connections/reconnect/${connectionId}`);
    return response.data;
  },

  async deleteConnection(connectionId: string, deleteSaved: boolean = false): Promise<void> {
    await axios.delete(`${API_BASE_URL}/connections/${connectionId}`, {
      params: { delete_saved: deleteSaved }
    });
  },

  async getSchema(connectionId: string): Promise<TableSchema[]> {
    const response = await axios.get(`${API_BASE_URL}/connections/${connectionId}/schema`);
    return response.data.schema;
  },

  // Query endpoints
  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const response = await axios.post(`${API_BASE_URL}/queries/execute`, request);
    return response.data;
  },

  async aiGenerateQuery(request: AIQueryRequest): Promise<QueryResult> {
    const response = await axios.post(`${API_BASE_URL}/queries/ai-generate`, request);
    return response.data;
  },
};
