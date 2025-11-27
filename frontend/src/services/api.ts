import axios, { AxiosError } from "axios";
import type {
  ConnectionConfig,
  ConnectionStatus,
  Connection,
  SavedConnection,
  TableSchema,
  ConnectionMetadata,
  TableMetadata,
  Query,
  QueryCreate,
  QueryTableSelection,
  QuerySelections,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  QueryUpdateRequest,
  QueryExecuteRequest,
  QueryExecuteResult,
  SQLHistoryList,
  SQLHistoryRestoreRequest,
  AISettings,
  AISettingsUpdate,
  FileInfo,
  FileUploadResponse,
  FileMetadata,
} from "../types";

// In Electron (file:// protocol), relative URLs don't work
// Use full URL to the backend server
const API_BASE_URL = "http://localhost:8080/api";

// Create axios instance with retry logic for connection errors
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Add response interceptor for retry logic on connection errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    
    // Only retry on network errors (connection refused, etc.)
    if (!config || !error.message?.includes('Network Error') && error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      return Promise.reject(error);
    }
    
    // Initialize retry count
    // @ts-expect-error - Adding custom property for retry tracking
    config._retryCount = config._retryCount || 0;
    
    // @ts-expect-error - Checking custom retry count
    if (config._retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }
    
    // @ts-expect-error - Incrementing retry count
    config._retryCount += 1;
    
    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    
    // Retry the request
    return axiosInstance(config);
  }
);

export const api = {
  // Connection endpoints
  async createConnection(config: ConnectionConfig): Promise<ConnectionStatus> {
    const response = await axiosInstance.post("/connections/", config);
    return response.data;
  },

  async listConnections(): Promise<Connection[]> {
    const response = await axiosInstance.get("/connections/");
    return response.data.connections;
  },

  async listSavedConnections(): Promise<SavedConnection[]> {
    const response = await axiosInstance.get("/connections/saved");
    return response.data.connections;
  },

  async getSavedConnection(connectionId: string): Promise<any> {
    const response = await axiosInstance.get(
      `/connections/saved/${connectionId}`
    );
    return response.data;
  },

  async updateSavedConnection(
    connectionId: string,
    config: ConnectionConfig
  ): Promise<void> {
    await axiosInstance.put(
      `/connections/saved/${connectionId}`,
      config
    );
  },

  async reconnectConnection(connectionId: string): Promise<ConnectionStatus> {
    const response = await axiosInstance.post(
      `/connections/reconnect/${connectionId}`
    );
    return response.data;
  },

  async deleteConnection(
    connectionId: string,
    deleteSaved: boolean = false
  ): Promise<void> {
    await axiosInstance.delete(`/connections/${connectionId}`, {
      params: { delete_saved: deleteSaved },
    });
  },

  async getSchema(connectionId: string): Promise<TableSchema[]> {
    const response = await axiosInstance.get(
      `/connections/${connectionId}/schema`
    );
    return response.data.schema;
  },

  // Metadata endpoints
  async getAllMetadata(): Promise<ConnectionMetadata[]> {
    const response = await axiosInstance.get("/metadata/");
    return response.data;
  },

  async getMetadata(connectionId: string): Promise<ConnectionMetadata> {
    const response = await axiosInstance.get(
      `/metadata/${connectionId}`
    );
    return response.data;
  },

  async refreshMetadata(connectionId: string): Promise<ConnectionMetadata> {
    const response = await axiosInstance.post(
      `/metadata/${connectionId}/refresh`
    );
    return response.data;
  },

  async getTableDetails(
    connectionId: string,
    schemaName: string,
    tableName: string
  ): Promise<TableMetadata> {
    const response = await axiosInstance.get(
      `/metadata/${connectionId}/table/${schemaName}/${tableName}`
    );
    return response.data;
  },

  // Query Management endpoints
  async listQueries(): Promise<Query[]> {
    const response = await axiosInstance.get("/queries/");
    return response.data;
  },

  async createQuery(data: QueryCreate): Promise<Query> {
    const response = await axiosInstance.post("/queries/", data);
    return response.data;
  },

  async getQuery(queryId: string): Promise<Query> {
    const response = await axiosInstance.get(`/queries/${queryId}`);
    return response.data;
  },

  async updateQuerySQL(
    queryId: string,
    data: QueryUpdateRequest
  ): Promise<Query> {
    const response = await axiosInstance.patch(
      `/queries/${queryId}/sql`,
      data
    );
    return response.data;
  },

  async updateQueryName(queryId: string, name: string): Promise<Query> {
    const response = await axiosInstance.patch(
      `/queries/${queryId}/name`,
      { name }
    );
    return response.data;
  },

  async deleteQuery(queryId: string): Promise<void> {
    await axiosInstance.delete(`/queries/${queryId}`);
  },

  async getQuerySelections(queryId: string): Promise<QuerySelections> {
    const response = await axiosInstance.get(
      `/queries/${queryId}/selections`
    );
    return response.data;
  },

  async addQuerySelection(
    queryId: string,
    selection: Omit<QueryTableSelection, "query_id">
  ): Promise<void> {
    await axiosInstance.post(
      `/queries/${queryId}/selections`,
      selection
    );
  },

  async removeQuerySelection(
    queryId: string,
    selection: Omit<QueryTableSelection, "query_id">
  ): Promise<void> {
    await axiosInstance.delete(`/queries/${queryId}/selections`, {
      data: selection,
    });
  },

  // Query Chat endpoints
  async chatWithAI(
    queryId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const response = await axiosInstance.post(
      `/queries/${queryId}/chat`,
      request
    );
    return response.data;
  },

  async getChatHistory(queryId: string): Promise<ChatMessage[]> {
    const response = await axiosInstance.get(`/queries/${queryId}/chat`);
    return response.data.messages || [];
  },

  async clearChatHistory(queryId: string): Promise<void> {
    await axiosInstance.delete(`/queries/${queryId}/chat`);
  },

  // Query Execution endpoints
  async executeQuery(
    queryId: string,
    request: QueryExecuteRequest
  ): Promise<QueryExecuteResult> {
    const response = await axiosInstance.post(
      `/queries/${queryId}/execute`,
      request
    );
    return response.data;
  },

  async exportQueryToCSV(
    queryId: string,
    request: QueryExecuteRequest
  ): Promise<Blob> {
    const response = await axiosInstance.post(
      `/queries/${queryId}/export`,
      request,
      {
        responseType: "blob",
      }
    );
    return response.data;
  },

  // SQL History endpoints
  async getSQLHistory(queryId: string): Promise<SQLHistoryList> {
    const response = await axiosInstance.get(
      `/queries/${queryId}/sql-history`
    );
    return response.data;
  },

  async restoreSQLFromHistory(
    queryId: string,
    request: SQLHistoryRestoreRequest
  ): Promise<Query> {
    const response = await axiosInstance.post(
      `/queries/${queryId}/sql-history/restore`,
      request
    );
    return response.data;
  },

  // Settings endpoints
  async getAISettings(): Promise<AISettings> {
    const response = await axiosInstance.get("/settings/ai");
    return response.data;
  },

  async updateAISettings(settings: AISettingsUpdate): Promise<AISettings> {
    const response = await axiosInstance.put("/settings/ai", settings);
    return response.data;
  },

  async clearAllData(): Promise<void> {
    await axiosInstance.post("/settings/clear-all-data");
  },

  // File endpoints
  async uploadFile(file: File, queryId: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axiosInstance.post("/files/upload", formData, {
      params: { query_id: queryId },
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async listFiles(queryId?: string): Promise<FileInfo[]> {
    const response = await axiosInstance.get("/files/", {
      params: queryId ? { query_id: queryId } : {},
    });
    return response.data;
  },

  async getFile(fileId: string): Promise<FileInfo> {
    const response = await axiosInstance.get(`/files/${fileId}`);
    return response.data;
  },

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const response = await axiosInstance.get(`/files/${fileId}/metadata`);
    return response.data;
  },

  async deleteFile(fileId: string): Promise<void> {
    await axiosInstance.delete(`/files/${fileId}`);
  },

  // S3 endpoints
  async listS3Files(
    connectionId: string,
    prefix: string = "",
    maxResults: number = 100,
    continuationToken?: string,
    flat: boolean = false
  ): Promise<{
    folders: Array<{ name: string; path: string; type: string }>;
    files: Array<{
      name: string;
      path: string;
      type: string;
      size: number;
      last_modified: string;
      extension: string;
      is_structured: boolean;
    }>;
    next_token?: string;
    truncated: boolean;
    count: number;
  }> {
    const response = await axiosInstance.get(`/s3/${connectionId}/list`, {
      params: {
        prefix,
        max_results: maxResults,
        continuation_token: continuationToken,
        flat,
      },
    });
    return response.data;
  },

  async getS3FileMetadata(
    connectionId: string,
    filePath: string
  ): Promise<{
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    row_count?: number;
    file_type: string;
    file_path: string;
    s3_path: string;
  }> {
    const response = await axiosInstance.get(
      `/s3/${connectionId}/metadata`,
      {
        params: { file_path: filePath },
      }
    );
    return response.data;
  },

  async createS3FileView(
    connectionId: string,
    filePath: string,
    viewName?: string
  ): Promise<{
    success: boolean;
    view_name: string;
    message: string;
  }> {
    const response = await axiosInstance.post(
      `/s3/${connectionId}/view`,
      null,
      {
        params: {
          file_path: filePath,
          view_name: viewName,
        },
      }
    );
    return response.data;
  },
};
