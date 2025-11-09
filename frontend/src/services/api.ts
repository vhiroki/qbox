import axios from "axios";
import type {
  ConnectionConfig,
  ConnectionStatus,
  Connection,
  SavedConnection,
  TableSchema,
  QueryRequest,
  QueryResult,
  ConnectionMetadata,
  WorkspaceTableSelection,
  WorkspaceSelections,
  WorkspaceMetadataExport,
} from "../types";

const API_BASE_URL = "/api";

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

  async getSavedConnection(connectionId: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/connections/saved/${connectionId}`
    );
    return response.data;
  },

  async updateSavedConnection(
    connectionId: string,
    config: ConnectionConfig
  ): Promise<void> {
    await axios.put(
      `${API_BASE_URL}/connections/saved/${connectionId}`,
      config
    );
  },

  async reconnectConnection(connectionId: string): Promise<ConnectionStatus> {
    const response = await axios.post(
      `${API_BASE_URL}/connections/reconnect/${connectionId}`
    );
    return response.data;
  },

  async deleteConnection(
    connectionId: string,
    deleteSaved: boolean = false
  ): Promise<void> {
    await axios.delete(`${API_BASE_URL}/connections/${connectionId}`, {
      params: { delete_saved: deleteSaved },
    });
  },

  async getSchema(connectionId: string): Promise<TableSchema[]> {
    const response = await axios.get(
      `${API_BASE_URL}/connections/${connectionId}/schema`
    );
    return response.data.schema;
  },

  // Query endpoints
  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const response = await axios.post(
      `${API_BASE_URL}/queries/execute`,
      request
    );
    return response.data;
  },

  // Metadata endpoints
  async getMetadata(connectionId: string): Promise<ConnectionMetadata> {
    const response = await axios.get(
      `${API_BASE_URL}/metadata/${connectionId}`
    );
    return response.data;
  },

  async refreshMetadata(connectionId: string): Promise<ConnectionMetadata> {
    const response = await axios.post(
      `${API_BASE_URL}/metadata/${connectionId}/refresh`
    );
    return response.data;
  },

  // Workspace endpoints
  async getWorkspaceSelections(): Promise<WorkspaceSelections> {
    const response = await axios.get(`${API_BASE_URL}/workspace/selections`);
    return response.data;
  },

  async addWorkspaceSelection(
    selection: WorkspaceTableSelection
  ): Promise<void> {
    await axios.post(`${API_BASE_URL}/workspace/selections`, selection);
  },

  async removeWorkspaceSelection(
    selection: WorkspaceTableSelection
  ): Promise<void> {
    await axios.delete(`${API_BASE_URL}/workspace/selections`, {
      data: selection,
    });
  },

  async clearWorkspace(): Promise<void> {
    await axios.delete(`${API_BASE_URL}/workspace/selections/all`);
  },

  async exportWorkspaceMetadata(): Promise<WorkspaceMetadataExport> {
    const response = await axios.get(`${API_BASE_URL}/workspace/export`);
    return response.data;
  },
};
