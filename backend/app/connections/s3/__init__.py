"""AWS S3 connection module."""

from typing import Any

from app.connections import BaseConnection, ConnectionRegistry
from app.models.schemas import DataSourceType, S3ConnectionConfig, TableSchema
from app.services.duckdb_manager import get_duckdb_manager


@ConnectionRegistry.register(DataSourceType.S3)
class S3Connection(BaseConnection):
    """
    AWS S3 data source using DuckDB's httpfs extension.
    
    Note: S3 is not "attached" like a database. Instead, we configure
    credentials as a DuckDB secret, and users query files directly using
    s3:// paths in their SQL queries (e.g., SELECT * FROM read_parquet('s3://bucket/file.parquet')).
    """

    def __init__(self, connection_id: str, connection_name: str, config: dict[str, Any]):
        super().__init__(connection_id, connection_name, config)
        # Parse and validate config using Pydantic
        self.s3_config = S3ConnectionConfig(**config)

    async def connect(self) -> bool:
        """Configure S3 credentials in DuckDB."""
        try:
            # Use the persistent DuckDB manager
            duckdb_manager = get_duckdb_manager()
            # Configure S3 credentials as a secret (validates credentials)
            duckdb_manager.configure_s3_secret(
                connection_id=self.connection_id,
                connection_name=self.connection_name,
                config=self.s3_config,
                custom_alias=None,  # Use auto-generated secret name
                force_recreate=False,
            )
            return True
        except Exception as e:
            self.connection_error = str(e)
            print(f"Failed to configure S3 credentials: {e}")
            return False

    async def disconnect(self) -> None:
        """
        Disconnect from S3.
        
        Note: The secret remains in DuckDB. It will be dropped when the connection
        is deleted via the cleanup() method.
        """
        pass

    async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """
        Execute a SQL query that may reference S3 files.
        
        Example query: SELECT * FROM read_parquet('s3://my-bucket/data.parquet')
        """
        duckdb_manager = get_duckdb_manager()
        return duckdb_manager.execute_query(query)

    async def get_schema(self) -> list[TableSchema]:
        """
        Get schema information from S3.
        
        Note: S3 doesn't have a traditional schema like databases.
        Users query individual files using s3:// paths in their SQL.
        This returns an empty list.
        """
        return []

    async def cleanup(self, duckdb_manager) -> None:
        """Cleanup S3 secret from DuckDB."""
        # For S3, we drop the secret from the persistent DuckDB instance
        duckdb_manager.detach_by_connection_id(self.connection_id, DataSourceType.S3)

