export interface ConnectionConfig {
  name: string;
  type: "postgres" | "s3" | "csv" | "excel";
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
  columns: ColumnMetadata[];
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

export interface WorkspaceTableSelection {
  connection_id: string;
  schema_name: string;
  table_name: string;
}

export interface WorkspaceSelections {
  selections: WorkspaceTableSelection[];
}

export interface WorkspaceMetadataExport {
  markdown: string;
  filename: string;
}
