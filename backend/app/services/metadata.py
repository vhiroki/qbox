"""Metadata collection service for data sources."""

import logging
from datetime import datetime
from typing import Any, Optional

from app.models.schemas import (
    ColumnMetadata,
    ConnectionMetadataLite,
    DataSourceType,
    PostgresConnectionConfig,
    TableMetadata,
)
from app.services.duckdb_manager import get_duckdb_manager
from app.services.metadata_collectors import PostgresMetadataCollector

logger = logging.getLogger(__name__)


class MetadataService:
    """Service for collecting metadata from various data sources."""

    def __init__(self):
        self.duckdb_manager = get_duckdb_manager()

    async def collect_postgres_metadata(
        self,
        connection_id: str,
        connection_name: str,
        config: PostgresConnectionConfig,
    ) -> ConnectionMetadataLite:
        """Collect lightweight metadata from a PostgreSQL database using native connection.

        Args:
            connection_id: Unique connection identifier
            connection_name: Human-readable connection name
            config: PostgreSQL connection configuration

        Returns:
            Lightweight metadata for the connection (table names only)
        """
        try:
            # Use native PostgreSQL collector (no DuckDB attachment needed for metadata)
            collector = PostgresMetadataCollector(config)
            metadata = await collector.collect_metadata(connection_id, connection_name)
            
            # Set timestamp
            metadata.last_updated = datetime.utcnow().isoformat()
            
            return metadata

        except Exception as e:
            logger.error(f"Failed to collect PostgreSQL metadata: {e}")
            raise


    async def get_table_details(
        self,
        connection_id: str,
        connection_name: str,
        source_type: DataSourceType,
        config: dict[str, Any],
        schema_name: str,
        table_name: str,
    ) -> TableMetadata:
        """Get detailed metadata for a specific table using native connection.

        Args:
            connection_id: Connection identifier
            connection_name: Connection name
            source_type: Type of data source
            config: Connection configuration
            schema_name: Schema name
            table_name: Table name

        Returns:
            Detailed table metadata with columns and row count
        """
        if source_type == DataSourceType.POSTGRES:
            postgres_config = PostgresConnectionConfig(**config)
            
            # Use native PostgreSQL collector (no DuckDB needed for metadata)
            collector = PostgresMetadataCollector(postgres_config)
            return await collector.get_table_details(schema_name, table_name)
        else:
            raise NotImplementedError(f"Table details not implemented for {source_type}")

    async def refresh_metadata(
        self,
        connection_id: str,
        connection_name: str,
        source_type: DataSourceType,
        config: dict[str, Any],
    ) -> ConnectionMetadataLite:
        """Refresh lightweight metadata for a connection.

        Args:
            connection_id: Connection identifier
            connection_name: Connection name
            source_type: Type of data source
            config: Connection configuration

        Returns:
            Updated lightweight metadata (table names only)
        """
        if source_type == DataSourceType.POSTGRES:
            postgres_config = PostgresConnectionConfig(**config)
            return await self.collect_postgres_metadata(
                connection_id, connection_name, postgres_config
            )
        else:
            raise NotImplementedError(f"Metadata collection not implemented for " f"{source_type}")


# Global metadata service instance
_metadata_service: Optional[MetadataService] = None


def get_metadata_service() -> MetadataService:
    """Get or create the global metadata service instance."""
    global _metadata_service
    if _metadata_service is None:
        _metadata_service = MetadataService()
    return _metadata_service


async def get_query_metadata(query_id: str) -> list[dict[str, Any]]:
    """
    Get metadata for all tables and files in a query.

    Returns a list of dictionaries containing table/file metadata with:
    - source_type: 'connection' or 'file'
    - connection_id (for tables) or file_id (for files)
    - connection_name or file_name
    - schema_name (for tables)
    - table_name
    - columns (list of column metadata)
    - row_count
    """
    from collections import defaultdict

    from app.services.connection_repository import connection_repository
    from app.services.file_repository import file_repository
    from app.services.query_repository import query_repository

    metadata_service = get_metadata_service()
    duckdb_manager = get_duckdb_manager()

    # Get all selections for this query
    selections = query_repository.get_query_selections(query_id)

    if not selections:
        return []

    query_metadata = []

    # Separate selections by source type
    connection_selections = [s for s in selections if s.source_type == "connection"]
    file_selections = [s for s in selections if s.source_type == "file"]

    # Process connection selections
    # Group selections by connection
    selections_by_connection = defaultdict(list)
    for selection in connection_selections:
        selections_by_connection[selection.connection_id].append(selection)

    # For each connection, get table metadata
    for connection_id, conn_selections in selections_by_connection.items():
        # Get connection config
        connection_config = connection_repository.get(connection_id)
        if not connection_config:
            logger.warning(f"Connection {connection_id} not found, skipping selections")
            continue

        # Get connection name from the config object
        connection_name = connection_config.name

        # Attach to DuckDB for query execution (this is needed for running queries)
        # The attachment is now cached, so this is a cheap operation after the first time
        try:
            # Parse connection config
            from app.models.schemas import PostgresConnectionConfig
            # connection_config is a ConnectionConfig object, access .config attribute
            postgres_config = PostgresConnectionConfig(**connection_config.config)
            
            # Attach the connection to DuckDB (needed for query execution)
            # Use custom alias from connection_config if available
            alias = duckdb_manager.attach_postgres(
                connection_id, connection_name, postgres_config, 
                custom_alias=connection_config.alias
            )
            
            # Create native collector for metadata (faster than querying DuckDB)
            collector = PostgresMetadataCollector(postgres_config)
            
        except Exception as e:
            logger.error(f"Failed to prepare connection {connection_id}: {e}")
            # Skip this entire connection if we can't set it up
            continue

        # For each table selection in this connection
        for selection in conn_selections:
            schema_name = selection.schema_name
            table_name = selection.table_name

            try:
                # Get metadata using native collector (no DuckDB queries needed)
                table_details = await collector.get_table_details(schema_name, table_name)

                query_metadata.append(
                    {
                        "source_type": "connection",
                        "connection_id": connection_id,
                        "connection_name": connection_name,
                        "alias": alias,  # Include DuckDB alias for SQL generation
                        "schema_name": schema_name,
                        "table_name": table_name,
                        "columns": [
                            {
                                "name": col.name,
                                "type": col.type,
                                "nullable": col.nullable,
                                "is_primary_key": col.is_primary_key,
                            }
                            for col in table_details.columns
                        ],
                        "row_count": table_details.row_count,
                    }
                )

            except Exception as e:
                logger.error(f"Failed to get metadata for " f"{schema_name}.{table_name}: {e}")
                # Continue with other tables
                continue

    # Process file selections
    for selection in file_selections:
        file_id = selection.connection_id  # For files, we store file_id in connection_id field
        
        try:
            # Get file info
            file_info = file_repository.get_file(file_id)
            if not file_info:
                logger.warning(f"File {file_id} not found, skipping")
                continue
            
            # Get the stored view_name from file_info
            view_name = file_info.get("view_name")
            if not view_name:
                logger.warning(f"File {file_id} has no view_name, skipping")
                continue
            
            # Get file metadata from DuckDB using the stored view_name
            file_metadata = duckdb_manager.get_file_metadata_by_view_name(view_name)
            
            query_metadata.append(
                {
                    "source_type": "file",
                    "file_id": file_id,
                    "file_name": file_info["name"],
                    "file_type": file_info["file_type"],
                    "view_name": view_name,  # For SQL generation
                    "table_name": file_info["name"],  # Use file name as table name
                    "columns": [
                        {
                            "name": col.name,
                            "type": col.type,
                            "nullable": col.nullable,
                            "is_primary_key": col.is_primary_key,
                        }
                        for col in file_metadata["columns"]
                    ],
                    "row_count": file_metadata.get("row_count"),
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to get metadata for file {file_id}: {e}")
            continue

    return query_metadata
