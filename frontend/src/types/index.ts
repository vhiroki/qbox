export type ConnectionType = "postgres" | "s3" | "mysql" | "oracle" | "dynamodb" | "csv" | "excel";

export interface ConnectionConfig {
  name: string;
  type: ConnectionType;
  config: Record<string, any>;
  alias?: string;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schemas?: string; // Comma-separated list of schemas, or empty for all schemas
}

export interface S3Config {
  bucket: string;
  credential_type: "default" | "manual";
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_session_token?: string;
  region?: string;
  endpoint_url?: string;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
  connection_id?: string;
}

export interface Connection {
  id: string;
  type: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  type: string;
  alias?: string;
  created_at: string;
  updated_at: string;
}

export interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
  row_count?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  is_primary_key: boolean;
}

export interface TableMetadata {
  name: string;
  schema_name?: string;
  columns?: ColumnMetadata[];  // Optional for lazy loading
  row_count?: number;
  description?: string;
}

export interface SchemaMetadata {
  name: string;
  tables: TableMetadata[];
}

export interface ConnectionMetadata {
  connection_id: string;
  connection_name: string;
  source_type: string;
  schemas: SchemaMetadata[];
  last_updated?: string;
}

export interface QueryRequest {
  connection_id: string;
  query: string;
}

export interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: Record<string, any>[];
  row_count?: number;
  error?: string;
}

// Query Models

export interface Query {
  id: string;
  name: string;
  sql_text: string;
  created_at: string;
  updated_at: string;
}

export interface QueryCreate {
  name: string;
  sql_text?: string;
}

export interface QueryTableSelection {
  query_id: string;
  connection_id: string;
  schema_name: string;
  table_name: string;
  source_type: string; // 'connection', 'file', 's3', etc.
}

export interface QuerySelections {
  query_id: string;
  selections: QueryTableSelection[];
}

export interface ChatMessage {
  id: number | string; // number for persisted, string for temporary
  query_id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  is_pending?: boolean; // true while waiting for backend
  has_error?: boolean; // true if failed to send
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  message: ChatMessage;
  updated_sql: string;
}

export interface QueryUpdateRequest {
  sql_text: string;
}

// AI Query Types

export interface AIQueryRequest {
  prompt: string;
  additional_instructions?: string;
}

export interface AIQueryResponse {
  query_id: string;
  generated_sql: string;
  explanation?: string;
}

export interface QueryExecutionRequest {
  sql: string;
  save_to_history?: boolean;
  query_id?: string;
}

export interface QueryExecutionResult {
  success: boolean;
  columns?: string[];
  rows?: Record<string, any>[];
  row_count?: number;
  execution_time_ms?: number;
  error?: string;
}

export interface QueryHistoryItem {
  id: string;
  query_id: string;
  prompt: string;
  generated_sql: string;
  executed_sql?: string;
  explanation?: string;
  row_count?: number;
  execution_time_ms?: number;
  error?: string;
  created_at: string;
}

export interface QueryHistoryList {
  query_id: string;
  queries: QueryHistoryItem[];
  total: number;
}

// Query Running Types

export interface QueryExecuteRequest {
  page?: number;
  page_size?: number;
  sql_text: string; // Execute this SQL from the current editor
}

export interface QueryExecuteResult {
  success: boolean;
  columns?: string[];
  rows?: Record<string, any>[];
  total_rows?: number;
  page: number;
  page_size: number;
  total_pages?: number;
  execution_time_ms?: number;
  error?: string;
}

// SQL History Types

export interface SQLHistoryItem {
  id: number;
  query_id: string;
  sql_text: string;
  created_at: string;
}

export interface SQLHistoryList {
  query_id: string;
  versions: SQLHistoryItem[];
}

export interface SQLHistoryRestoreRequest {
  history_id: number;
}

// Settings Types

export interface AISettings {
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  gemini_api_key?: string | null;
  ai_model: string;
  ai_temperature: number;
}

export interface AISettingsUpdate {
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  gemini_api_key?: string | null;
  ai_model?: string;
  ai_temperature?: number;
}

// File Types

export interface FileInfo {
  id: string;
  name: string;
  original_filename: string;
  file_type: "csv" | "xlsx";
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface FileUploadResponse {
  id: string;
  name: string;
  original_filename: string;
  file_type: "csv" | "xlsx";
  size_bytes: number;
  created_at: string;
}

export interface FileMetadata {
  file_id: string;
  file_name: string;
  file_type: "csv" | "xlsx";
  view_name: string;
  columns: ColumnMetadata[];
  row_count?: number;
}
