"""Metadata collection service for data sources."""

import logging
from datetime import datetime
from typing import Any, Optional

from app.models.schemas import (
    ColumnMetadata,
    ConnectionMetadata,
    DataSourceType,
    PostgresConnectionConfig,
    SchemaMetadata,
    TableMetadata,
)
from app.services.duckdb_manager import get_duckdb_manager

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
    ) -> ConnectionMetadata:
        """Collect metadata from a PostgreSQL database.

        Args:
            connection_id: Unique connection identifier
            connection_name: Human-readable connection name
            config: PostgreSQL connection configuration

        Returns:
            Complete metadata for the connection
        """
        try:
            # Attach the database (custom_alias is None here since it's part of connection config)
            # This is called from API with just PostgresConnectionConfig, not the full ConnectionConfig
            alias = self.duckdb_manager.attach_postgres(
                connection_id, connection_name, config, custom_alias=None
            )

            # Get schema information
            schemas = await self._get_postgres_schemas(alias, config.schema_name)

            return ConnectionMetadata(
                connection_id=connection_id,
                connection_name=connection_name,
                source_type=DataSourceType.POSTGRES,
                schemas=schemas,
                last_updated=datetime.utcnow().isoformat(),
            )

        except Exception as e:
            logger.error(f"Failed to collect PostgreSQL metadata: {e}")
            raise

    async def _get_postgres_schemas(
        self, alias: str, schema_filter: Optional[str] = None
    ) -> list[SchemaMetadata]:
        """Get schemas and tables from PostgreSQL."""
        conn = self.duckdb_manager.connect()

        # Use DuckDB's system tables to get schemas for this specific database
        if schema_filter:
            schema_query = f"""
                SELECT DISTINCT schema_name
                FROM duckdb_schemas()
                WHERE database_name = '{alias}'
                AND schema_name = '{schema_filter}'
                AND schema_name NOT IN ('information_schema', 'pg_catalog')
            """
        else:
            schema_query = f"""
                SELECT DISTINCT schema_name
                FROM duckdb_schemas()
                WHERE database_name = '{alias}'
                AND schema_name NOT IN ('information_schema', 'pg_catalog')
            """

        result = conn.execute(schema_query)
        schema_names = [row[0] for row in result.fetchall()]

        schemas = []
        for schema_name in schema_names:
            tables = await self._get_postgres_tables(alias, schema_name)
            if tables:  # Only include schemas with tables
                schemas.append(SchemaMetadata(name=schema_name, tables=tables))

        return schemas

    async def _get_postgres_tables(self, alias: str, schema_name: str) -> list[TableMetadata]:
        """Get tables and columns for a specific schema."""
        conn = self.duckdb_manager.connect()

        # Use DuckDB's system tables to get tables for this specific database and schema
        tables_query = f"""
            SELECT DISTINCT table_name
            FROM duckdb_tables()
            WHERE database_name = '{alias}'
            AND schema_name = '{schema_name}'
            ORDER BY table_name
        """

        result = conn.execute(tables_query)
        table_names = [row[0] for row in result.fetchall()]

        tables = []
        for table_name in table_names:
            columns = await self._get_postgres_columns(alias, schema_name, table_name)

            # Get row count
            try:
                count_query = f"SELECT COUNT(*) FROM {alias}." f"{schema_name}.{table_name}"
                count_result = conn.execute(count_query)
                row_count = count_result.fetchone()[0]
            except Exception as e:
                logger.warning(f"Could not get row count for " f"{schema_name}.{table_name}: {e}")
                row_count = None

            tables.append(
                TableMetadata(
                    name=table_name,
                    schema_name=schema_name,
                    columns=columns,
                    row_count=row_count,
                )
            )

        return tables

    async def _get_postgres_columns(
        self, alias: str, schema_name: str, table_name: str
    ) -> list[ColumnMetadata]:
        """Get column information for a specific table."""
        conn = self.duckdb_manager.connect()

        # Use DuckDB's system tables to get columns for this specific table
        columns_query = f"""
            SELECT
                column_name,
                data_type,
                is_nullable,
                false as is_primary_key
            FROM duckdb_columns()
            WHERE database_name = '{alias}'
            AND schema_name = '{schema_name}'
            AND table_name = '{table_name}'
            ORDER BY column_index
        """

        result = conn.execute(columns_query)
        rows = result.fetchall()

        columns = []
        for row in rows:
            column_name, data_type, is_nullable, is_pk = row
            columns.append(
                ColumnMetadata(
                    name=column_name,
                    type=data_type,
                    nullable=bool(is_nullable),  # DuckDB returns boolean
                    is_primary_key=bool(is_pk),
                )
            )

        return columns

    async def refresh_metadata(
        self,
        connection_id: str,
        connection_name: str,
        source_type: DataSourceType,
        config: dict[str, Any],
    ) -> ConnectionMetadata:
        """Refresh metadata for a connection.

        Args:
            connection_id: Connection identifier
            connection_name: Connection name
            source_type: Type of data source
            config: Connection configuration

        Returns:
            Updated metadata
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
    Get metadata for all tables in a query.

    Returns a list of dictionaries containing table metadata with:
    - connection_id
    - connection_name
    - schema_name
    - table_name
    - columns (list of column metadata)
    - row_count
    """
    from collections import defaultdict

    from app.services.connection_repository import connection_repository
    from app.services.query_repository import query_repository

    metadata_service = get_metadata_service()
    duckdb_manager = get_duckdb_manager()

    # Get all selections for this query
    selections = query_repository.get_query_selections(query_id)

    if not selections:
        return []

    query_metadata = []

    # Group selections by connection
    selections_by_connection = defaultdict(list)
    for selection in selections:
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

        # Check if catalog exists in DuckDB, if not, try to attach it
        try:
            # Parse connection config
            from app.models.schemas import PostgresConnectionConfig
            # connection_config is a ConnectionConfig object, access .config attribute
            postgres_config = PostgresConnectionConfig(**connection_config.config)
            
            # Attach (or re-attach) the connection - this will detach if already exists
            # Use custom alias from connection_config if available
            alias = duckdb_manager.attach_postgres(
                connection_id, connection_name, postgres_config, 
                custom_alias=connection_config.alias
            )
        except Exception as e:
            logger.error(f"Failed to attach connection {connection_id}: {e}")
            # Skip this entire connection if we can't attach it
            continue

        # For each table selection in this connection
        for selection in conn_selections:
            schema_name = selection.schema_name
            table_name = selection.table_name

            try:
                # Get columns for this table
                columns = await metadata_service._get_postgres_columns(
                    alias, schema_name, table_name
                )

                # Get row count
                conn = duckdb_manager.connect()
                try:
                    count_query = f"SELECT COUNT(*) FROM {alias}." f"{schema_name}.{table_name}"
                    count_result = conn.execute(count_query)
                    row_count = count_result.fetchone()[0]
                except Exception as e:
                    logger.warning(
                        f"Could not get row count for " f"{schema_name}.{table_name}: {e}"
                    )
                    row_count = None

                query_metadata.append(
                    {
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
                            for col in columns
                        ],
                        "row_count": row_count,
                    }
                )

            except Exception as e:
                logger.error(f"Failed to get metadata for " f"{schema_name}.{table_name}: {e}")
                # Continue with other tables
                continue

    return query_metadata
