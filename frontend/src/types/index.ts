export interface ConnectionConfig {
  name: string;
  type: 'postgres' | 's3' | 'csv' | 'excel';
  config: Record<string, any>;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema?: string;
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

export interface QueryRequest {
  connection_id: string;
  query: string;
}

export interface AIQueryRequest {
  connection_id: string;
  prompt: string;
  execute: boolean;
}

export interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: Record<string, any>[];
  row_count?: number;
  error?: string;
  generated_sql?: string;
}
