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


class WorkspaceTableSelection(BaseModel):
    """Represents a table selected in the workspace."""

    connection_id: str
    schema_name: str
    table_name: str


class WorkspaceSelections(BaseModel):
    """All table selections in the workspace."""

    selections: list[WorkspaceTableSelection]


class WorkspaceMetadataExport(BaseModel):
    """Metadata export for workspace selections."""

    markdown: str
    filename: str
