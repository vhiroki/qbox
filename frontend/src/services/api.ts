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
  Workspace,
  WorkspaceCreate,
  WorkspaceTableSelection,
  WorkspaceSelections,
  WorkspaceMetadataExport,
  AIQueryRequest,
  AIQueryResponse,
  QueryExecutionRequest,
  QueryExecutionResult,
  QueryHistoryList,
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
  async listWorkspaces(): Promise<Workspace[]> {
    const response = await axios.get(`${API_BASE_URL}/workspaces/`);
    return response.data;
  },

  async createWorkspace(data: WorkspaceCreate): Promise<Workspace> {
    const response = await axios.post(`${API_BASE_URL}/workspaces/`, data);
    return response.data;
  },

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const response = await axios.get(
      `${API_BASE_URL}/workspaces/${workspaceId}`
    );
    return response.data;
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/workspaces/${workspaceId}`);
  },

  async getWorkspaceSelections(
    workspaceId: string
  ): Promise<WorkspaceSelections> {
    const response = await axios.get(
      `${API_BASE_URL}/workspaces/${workspaceId}/selections`
    );
    return response.data;
  },

  async addWorkspaceSelection(
    workspaceId: string,
    selection: Omit<WorkspaceTableSelection, "workspace_id">
  ): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/workspaces/${workspaceId}/selections`,
      selection
    );
  },

  async removeWorkspaceSelection(
    workspaceId: string,
    selection: Omit<WorkspaceTableSelection, "workspace_id">
  ): Promise<void> {
    await axios.delete(`${API_BASE_URL}/workspaces/${workspaceId}/selections`, {
      data: selection,
    });
  },

  async exportWorkspaceMetadata(
    workspaceId: string
  ): Promise<WorkspaceMetadataExport> {
    const response = await axios.get(
      `${API_BASE_URL}/workspaces/${workspaceId}/export`
    );
    return response.data;
  },

  // AI Query endpoints
  async generateQuery(
    workspaceId: string,
    request: AIQueryRequest
  ): Promise<AIQueryResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/workspaces/${workspaceId}/ai-query`,
      request
    );
    return response.data;
  },

  async executeAIQuery(
    workspaceId: string,
    request: QueryExecutionRequest
  ): Promise<QueryExecutionResult> {
    const response = await axios.post(
      `${API_BASE_URL}/workspaces/${workspaceId}/execute-query`,
      request
    );
    return response.data;
  },

  async getQueryHistory(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<QueryHistoryList> {
    const response = await axios.get(
      `${API_BASE_URL}/workspaces/${workspaceId}/query-history`,
      { params: { limit, offset } }
    );
    return response.data;
  },

  async deleteQueryFromHistory(
    workspaceId: string,
    queryId: string
  ): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/workspaces/${workspaceId}/query-history/${queryId}`
    );
  },

  async clearQueryHistory(workspaceId: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/workspaces/${workspaceId}/query-history`
    );
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
