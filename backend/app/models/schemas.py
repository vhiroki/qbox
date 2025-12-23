from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class DataSourceType(str, Enum):
    """Supported data source types."""

    POSTGRES = "postgres"
    S3 = "s3"
    MYSQL = "mysql"
    ORACLE = "oracle"
    DYNAMODB = "dynamodb"
    # File-based sources
    CSV = "csv"
    EXCEL = "excel"


class ConnectionConfig(BaseModel):
    """Base connection configuration."""

    name: str
    type: DataSourceType
    config: dict[str, Any]


class PostgresConnectionConfig(BaseModel):
    """PostgreSQL connection configuration."""

    host: str
    port: int = 5432
    database: str
    username: str
    password: str
    schema_names: Optional[list[str]] = Field(default=None, alias="schemas")

    @model_validator(mode="before")
    @classmethod
    def convert_schemas_to_list(cls, data: Any) -> Any:
        """Convert schema/schemas field to list format.

        Handles:
        - Legacy 'schema' field (single string)
        - 'schemas' as comma-separated string
        - 'schemas' as list (already correct format)
        """
        if isinstance(data, dict):
            # Handle legacy 'schema' field
            if "schema" in data and "schemas" not in data:
                schema_value = data.pop("schema")
                if schema_value and isinstance(schema_value, str) and schema_value.strip():
                    if "," in schema_value:
                        data["schemas"] = [s.strip() for s in schema_value.split(",") if s.strip()]
                    else:
                        data["schemas"] = [schema_value.strip()]
                else:
                    data["schemas"] = None

            # Handle 'schemas' as string (convert to list)
            elif "schemas" in data and isinstance(data["schemas"], str):
                schema_value = data["schemas"]
                if schema_value and schema_value.strip():
                    if "," in schema_value:
                        data["schemas"] = [s.strip() for s in schema_value.split(",") if s.strip()]
                    else:
                        data["schemas"] = [schema_value.strip()]
                else:
                    data["schemas"] = None

            # 'schemas' as list or None is already in correct format

        return data


class S3ConnectionConfig(BaseModel):
    """AWS S3 connection configuration."""

    bucket: str
    credential_type: str = Field(
        default="default",
        description="Either 'default' for AWS credential provider chain or 'manual' for explicit credentials",
    )
    # Manual credentials (only required if credential_type == 'manual')
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None
    region: Optional[str] = Field(default="us-east-1", description="AWS region")
    endpoint_url: Optional[str] = Field(
        default=None,
        description="Custom S3 endpoint URL (e.g., http://localhost:4566 for LocalStack)",
    )

    @model_validator(mode="after")
    def validate_credentials(self) -> "S3ConnectionConfig":
        """Validate that manual credentials are provided when credential_type is 'manual'."""
        if self.credential_type == "manual":
            if not self.aws_access_key_id or not self.aws_secret_access_key:
                raise ValueError(
                    "aws_access_key_id and aws_secret_access_key are required when credential_type is 'manual'"
                )
        return self


class ConnectionStatus(BaseModel):
    """Connection status response."""

    success: bool
    message: str
    connection_id: Optional[str] = None


class QueryRequest(BaseModel):
    """Query execution request."""

    connection_id: str
    query: str


class QueryResult(BaseModel):
    """Query execution result."""

    success: bool
    columns: Optional[list[str]] = None
    rows: Optional[list[dict[str, Any]]] = None
    row_count: Optional[int] = None
    error: Optional[str] = None


class ColumnMetadata(BaseModel):
    """Column metadata information."""

    name: str
    type: str
    nullable: bool = True
    description: Optional[str] = None
    is_primary_key: bool = False


class TableMetadata(BaseModel):
    """Table metadata information (full details)."""

    name: str
    schema_name: Optional[str] = None
    columns: Optional[list[ColumnMetadata]] = None  # Optional for lazy loading
    row_count: Optional[int] = None
    description: Optional[str] = None


class TableMetadataLite(BaseModel):
    """Lightweight table metadata (name only) for list endpoints."""

    name: str
    schema_name: Optional[str] = None


class SchemaMetadataLite(BaseModel):
    """Lightweight schema metadata for list endpoints."""

    name: str
    tables: list[TableMetadataLite]


class ConnectionMetadataLite(BaseModel):
    """Lightweight connection metadata for list endpoints."""

    connection_id: str
    connection_name: str
    source_type: DataSourceType
    schemas: list[SchemaMetadataLite]
    last_updated: Optional[str] = None


class TableSchema(BaseModel):
    """Table schema information (legacy, for backwards compatibility)."""

    table_name: str
    columns: list[dict[str, str]]
    row_count: Optional[int] = None


# Query Models


class Query(BaseModel):
    """A query containing SQL text and selected tables."""

    id: str
    name: str
    sql_text: str
    created_at: str
    updated_at: str


class QueryCreate(BaseModel):
    """Request to create a new query."""

    name: str
    sql_text: str = ""


class QueryTableSelectionRequest(BaseModel):
    """Request to add/remove a table from query."""

    connection_id: str
    schema_name: str
    table_name: str
    source_type: str = "connection"  # Default to 'connection' for backwards compatibility


class QueryTableSelection(BaseModel):
    """Represents a table selected in a query."""

    query_id: str
    connection_id: str
    schema_name: str
    table_name: str
    source_type: str = "connection"  # 'connection', 'file', 's3', etc.


class QuerySelections(BaseModel):
    """All table selections in a query."""

    query_id: str
    selections: list[QueryTableSelection]


class ChatMessage(BaseModel):
    """A chat message in query conversation."""

    id: int
    query_id: str
    role: str  # 'user' or 'assistant'
    message: str
    created_at: str


class ChatRequest(BaseModel):
    """Request to send a chat message."""

    message: str


class ChatResponse(BaseModel):
    """Response from chat interaction."""

    message: ChatMessage
    updated_sql: str


class QueryUpdateRequest(BaseModel):
    """Request to update query SQL."""

    sql_text: str


class QueryNameUpdateRequest(BaseModel):
    """Request to update query name."""

    name: str


# AI Query Models


class AIQueryRequest(BaseModel):
    """Request to generate SQL from natural language."""

    prompt: str
    additional_instructions: Optional[str] = None


class AIQueryResponse(BaseModel):
    """Response with generated SQL and explanation."""

    query_id: str
    generated_sql: str
    explanation: Optional[str] = None


class QueryExecutionRequest(BaseModel):
    """Request to execute a SQL query."""

    sql: str
    save_to_history: bool = True
    query_id: Optional[str] = None  # Reference to AI-generated query


class QueryExecutionResult(BaseModel):
    """Result of query execution."""

    success: bool
    columns: Optional[list[str]] = None
    rows: Optional[list[dict[str, Any]]] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error: Optional[str] = None


class QueryHistoryItem(BaseModel):
    """A query history item."""

    id: str
    query_id: str
    prompt: str
    generated_sql: str
    executed_sql: Optional[str] = None
    explanation: Optional[str] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error: Optional[str] = None
    created_at: str


class QueryHistoryList(BaseModel):
    """List of query history items."""

    query_id: str
    queries: list[QueryHistoryItem]
    total: int


# Query Execution Models for Query Running


class QueryExecuteRequest(BaseModel):
    """Request to execute a query with pagination."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=100, ge=1, le=1000)
    sql_text: str  # Execute this SQL from the current editor


class QueryExecuteResult(BaseModel):
    """Result of query execution with pagination."""

    success: bool
    columns: Optional[list[str]] = None
    rows: Optional[list[dict[str, Any]]] = None
    total_rows: Optional[int] = None
    page: int
    page_size: int
    total_pages: Optional[int] = None
    execution_time_ms: Optional[float] = None
    error: Optional[str] = None


# SQL History Models


class SQLHistoryItem(BaseModel):
    """A SQL history version."""

    id: int
    query_id: str
    sql_text: str
    created_at: str


class SQLHistoryList(BaseModel):
    """List of SQL history versions."""

    query_id: str
    versions: list[SQLHistoryItem]


class SQLHistoryRestoreRequest(BaseModel):
    """Request to restore a SQL version from history."""

    history_id: int


# Settings Models


class AISettings(BaseModel):
    """AI configuration settings."""

    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ai_model: str = "gpt-4o"
    ai_temperature: float = 0.1


class AISettingsUpdate(BaseModel):
    """Request to update AI settings (all fields optional)."""

    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    ai_temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


# File Models


class FileUploadResponse(BaseModel):
    """Response after file upload."""

    id: str
    name: str
    original_filename: str
    file_type: str
    size_bytes: int
    created_at: str


class FileInfo(BaseModel):
    """File information."""

    id: str
    name: str
    original_filename: str
    file_type: str
    size_bytes: int
    created_at: str
    updated_at: str


class FileMetadata(BaseModel):
    """File metadata with schema information."""

    file_id: str
    file_name: str
    file_type: str
    view_name: str
    columns: list[ColumnMetadata]
    row_count: Optional[int] = None
