"""AWS S3 connection module."""

from datetime import datetime
from typing import Any, Optional

from app.connections import BaseConnection, ConnectionRegistry
from app.models.schemas import (
    ConnectionMetadataLite,
    DataSourceType,
    S3ConnectionConfig,
    TableSchema,
)
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

    async def get_metadata_lite(self) -> list[dict[str, str]]:
        """
        Get lightweight metadata from S3.
        
        Note: S3 doesn't have a traditional schema like databases.
        Returns empty list.
        """
        return []

    async def collect_metadata(self) -> ConnectionMetadataLite:
        """
        Collect full lightweight metadata structure from S3.
        
        Note: S3 doesn't have a traditional schema like databases.
        Returns empty metadata structure.
        """
        return ConnectionMetadataLite(
            connection_id=self.connection_id,
            connection_name=self.connection_name,
            source_type=DataSourceType.S3,
            schemas=[],
            last_updated=datetime.utcnow().isoformat(),
        )

    def attach_to_duckdb(self, duckdb_manager, custom_alias: Optional[str] = None) -> str:
        """
        Attach S3 connection to DuckDB for query execution.
        
        Note: S3 connections use secrets which are configured during connection creation.
        This method returns the existing secret name/alias.
        """
        alias = duckdb_manager.get_attached_alias(self.connection_id)
        if not alias:
            raise RuntimeError(f"S3 connection {self.connection_id} not configured in DuckDB")
        return alias

    async def get_table_details(self, schema_name: str, table_name: str) -> dict[str, Any]:
        """
        Get detailed metadata for a specific S3 file.
        
        Note: S3 doesn't have traditional tables.
        Raises NotImplementedError.
        """
        raise NotImplementedError("S3 doesn't support table details")

    async def cleanup(self, duckdb_manager) -> None:
        """Cleanup S3 secret from DuckDB."""
        # For S3, we drop the secret from the persistent DuckDB instance
        identifier = duckdb_manager.get_attached_alias(self.connection_id)
        if identifier:
            duckdb_manager.drop_secret(identifier)
            duckdb_manager.remove_connection_from_cache(self.connection_id)

    def preserve_sensitive_fields(self, new_config: dict[str, Any], existing_config: dict[str, Any]) -> dict[str, Any]:
        """Preserve AWS credentials if they're empty in the update."""
        # AWS Access Key ID
        if "aws_access_key_id" in new_config and not new_config["aws_access_key_id"]:
            if "aws_access_key_id" in existing_config:
                new_config["aws_access_key_id"] = existing_config["aws_access_key_id"]
        
        # AWS Secret Access Key
        if "aws_secret_access_key" in new_config and not new_config["aws_secret_access_key"]:
            if "aws_secret_access_key" in existing_config:
                new_config["aws_secret_access_key"] = existing_config["aws_secret_access_key"]
        
        # AWS Session Token (optional)
        if "aws_session_token" in new_config and not new_config["aws_session_token"]:
            if "aws_session_token" in existing_config:
                new_config["aws_session_token"] = existing_config["aws_session_token"]
        
        return new_config

    def mask_sensitive_fields(self, config: dict[str, Any]) -> dict[str, Any]:
        """Mask AWS credentials for safe display."""
        safe_config = config.copy()
        if "aws_access_key_id" in safe_config:
            safe_config["aws_access_key_id"] = ""
        if "aws_secret_access_key" in safe_config:
            safe_config["aws_secret_access_key"] = ""
        if "aws_session_token" in safe_config:
            safe_config["aws_session_token"] = ""
        return safe_config

