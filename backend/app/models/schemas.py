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


class AIQueryRequest(BaseModel):
    """AI-powered query generation request."""

    connection_id: str
    prompt: str
    execute: bool = False


class QueryResult(BaseModel):
    """Query execution result."""

    success: bool
    columns: Optional[list[str]] = None
    rows: Optional[list[dict[str, Any]]] = None
    row_count: Optional[int] = None
    error: Optional[str] = None
    generated_sql: Optional[str] = None


class TableSchema(BaseModel):
    """Table schema information."""

    table_name: str
    columns: list[dict[str, str]]
    row_count: Optional[int] = None
