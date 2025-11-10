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
            # Attach the database
            alias = self.duckdb_manager.attach_postgres(connection_id, config)

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

        # Query to get all schemas
        if schema_filter:
            schema_query = f"""
                SELECT DISTINCT table_schema
                FROM information_schema.tables
                WHERE table_schema = '{schema_filter}'
                AND table_type = 'BASE TABLE'
            """
        else:
            schema_query = """
                SELECT DISTINCT table_schema
                FROM information_schema.tables
                WHERE table_schema NOT IN (
                    'information_schema', 'pg_catalog'
                )
                AND table_type = 'BASE TABLE'
            """

        result = conn.execute(schema_query)
        schema_names = [row[0] for row in result.fetchall()]

        schemas = []
        for schema_name in schema_names:
            tables = await self._get_postgres_tables(alias, schema_name)
            schemas.append(SchemaMetadata(name=schema_name, tables=tables))

        return schemas

    async def _get_postgres_tables(self, alias: str, schema_name: str) -> list[TableMetadata]:
        """Get tables and columns for a specific schema."""
        conn = self.duckdb_manager.connect()

        # Query to get tables
        tables_query = f"""
            SELECT DISTINCT table_name
            FROM information_schema.tables
            WHERE table_schema = '{schema_name}'
            AND table_type = 'BASE TABLE'
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

        # Query to get columns with constraints
        columns_query = f"""
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                CASE
                    WHEN pk.column_name IS NOT NULL THEN true
                    ELSE false
                END as is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = '{schema_name}'
                AND tc.table_name = '{table_name}'
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = '{schema_name}'
            AND c.table_name = '{table_name}'
            ORDER BY c.ordinal_position
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
                    nullable=(is_nullable == "YES"),
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


async def get_workspace_metadata(workspace_id: str) -> list[dict[str, Any]]:
    """
    Get metadata for all tables in a workspace.

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
    from app.services.workspace_repository import workspace_repository

    metadata_service = get_metadata_service()
    duckdb_manager = get_duckdb_manager()

    # Get all selections for this workspace
    selections = workspace_repository.get_workspace_selections(workspace_id)

    if not selections:
        return []

    workspace_metadata = []

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

        # Get connection name from repository
        all_connections = connection_repository.get_all()
        connection_name = next(
            (c["name"] for c in all_connections if c["id"] == connection_id),
            "Unknown",
        )

        # Get DuckDB alias for this connection
        alias = f"pg_{connection_id.replace('-', '_')}"

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

                workspace_metadata.append(
                    {
                        "connection_id": connection_id,
                        "connection_name": connection_name,
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

    return workspace_metadata


async def get_query_metadata(query_id: str) -> list[dict[str, Any]]:
    """
    Get metadata for all tables in a query (same as workspace but for queries).

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

        # Get connection name from repository
        all_connections = connection_repository.get_all()
        connection_name = next(
            (c["name"] for c in all_connections if c["id"] == connection_id),
            "Unknown",
        )

        # Get DuckDB alias for this connection
        alias = f"pg_{connection_id.replace('-', '_')}"

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
