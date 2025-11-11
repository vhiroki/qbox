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
  Query,
  QueryCreate,
  QueryTableSelection,
  QuerySelections,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  QueryUpdateRequest,
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

  // Query Management endpoints
  async listQueries(): Promise<Query[]> {
    const response = await axios.get(`${API_BASE_URL}/queries/`);
    return response.data;
  },

  async createQuery(data: QueryCreate): Promise<Query> {
    const response = await axios.post(`${API_BASE_URL}/queries/`, data);
    return response.data;
  },

  async getQuery(queryId: string): Promise<Query> {
    const response = await axios.get(`${API_BASE_URL}/queries/${queryId}`);
    return response.data;
  },

  async updateQuerySQL(
    queryId: string,
    data: QueryUpdateRequest
  ): Promise<Query> {
    const response = await axios.patch(
      `${API_BASE_URL}/queries/${queryId}/sql`,
      data
    );
    return response.data;
  },

  async updateQueryName(queryId: string, name: string): Promise<Query> {
    const response = await axios.patch(
      `${API_BASE_URL}/queries/${queryId}/name`,
      { name }
    );
    return response.data;
  },

  async deleteQuery(queryId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/queries/${queryId}`);
  },

  async getQuerySelections(queryId: string): Promise<QuerySelections> {
    const response = await axios.get(
      `${API_BASE_URL}/queries/${queryId}/selections`
    );
    return response.data;
  },

  async addQuerySelection(
    queryId: string,
    selection: Omit<QueryTableSelection, "query_id">
  ): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/queries/${queryId}/selections`,
      selection
    );
  },

  async removeQuerySelection(
    queryId: string,
    selection: Omit<QueryTableSelection, "query_id">
  ): Promise<void> {
    await axios.delete(`${API_BASE_URL}/queries/${queryId}/selections`, {
      data: selection,
    });
  },

  // Query Chat endpoints
  async chatWithAI(
    queryId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/queries/${queryId}/chat`,
      request
    );
    return response.data;
  },

  async getChatHistory(queryId: string): Promise<ChatMessage[]> {
    const response = await axios.get(`${API_BASE_URL}/queries/${queryId}/chat`);
    return response.data.messages || [];
  },

  async clearChatHistory(queryId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/queries/${queryId}/chat`);
  },
};
