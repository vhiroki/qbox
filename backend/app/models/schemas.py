from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    """Supported data source types."""

    POSTGRES = "postgres"
    # Future data sources
    S3 = "s3"
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
    schema_name: str = Field(default="public", alias="schema")


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
    """Table metadata information."""

    name: str
    schema_name: Optional[str] = None
    columns: list[ColumnMetadata]
    row_count: Optional[int] = None
    description: Optional[str] = None


class SchemaMetadata(BaseModel):
    """Schema metadata information."""

    name: str
    tables: list[TableMetadata]


class ConnectionMetadata(BaseModel):
    """Complete metadata for a connection."""

    connection_id: str
    connection_name: str
    source_type: DataSourceType
    schemas: list[SchemaMetadata]
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


class QueryTableSelection(BaseModel):
    """Represents a table selected in a query."""

    query_id: str
    connection_id: str
    schema_name: str
    table_name: str


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
