"""Native metadata collectors for different database types.

These collectors connect directly to databases using native Python clients
to extract schema metadata, avoiding the need to attach to DuckDB.
"""

import logging
from typing import Optional

import psycopg
from psycopg.rows import dict_row

from app.models.schemas import (
    ColumnMetadata,
    ConnectionMetadataLite,
    DataSourceType,
    PostgresConnectionConfig,
    SchemaMetadataLite,
    TableMetadata,
    TableMetadataLite,
)

logger = logging.getLogger(__name__)


class PostgresMetadataCollector:
    """Collects metadata directly from PostgreSQL using psycopg3 (async)."""

    def __init__(self, config: PostgresConnectionConfig):
        """Initialize collector with connection configuration."""
        self.config = config

    async def collect_metadata(
        self, connection_id: str, connection_name: str
    ) -> ConnectionMetadataLite:
        """Collect lightweight metadata from PostgreSQL database.

        Args:
            connection_id: Unique connection identifier
            connection_name: Human-readable connection name

        Returns:
            Lightweight metadata for the connection (table names only)
        """
        # Connect directly to PostgreSQL (async)
        conn_string = (
            f"host={self.config.host} "
            f"port={self.config.port} "
            f"dbname={self.config.database} "
            f"user={self.config.username} "
            f"password={self.config.password} "
            f"connect_timeout=10"
        )
        
        async with await psycopg.AsyncConnection.connect(conn_string) as conn:
            # Get schemas (lightweight)
            schemas = await self._get_schemas_lite(conn)

            return ConnectionMetadataLite(
                connection_id=connection_id,
                connection_name=connection_name,
                source_type=DataSourceType.POSTGRES,
                schemas=schemas,
                last_updated=None,  # Will be set by caller
            )

    async def _get_schemas_lite(
        self, conn: psycopg.AsyncConnection
    ) -> list[SchemaMetadataLite]:
        """Get all schemas with their tables (lightweight - names only).

        Args:
            conn: Active PostgreSQL connection

        Returns:
            List of schemas with table names only
        """
        async with conn.cursor(row_factory=dict_row) as cursor:
            # Build schema filter
            if self.config.schema_names and len(self.config.schema_names) > 0:
                # Filter by specific schemas
                schema_placeholders = ",".join(["%s"] * len(self.config.schema_names))
                schema_query = f"""
                    SELECT DISTINCT schema_name
                    FROM information_schema.schemata
                    WHERE schema_name IN ({schema_placeholders})
                    AND schema_name NOT IN ('information_schema', 'pg_catalog')
                    ORDER BY schema_name
                """
                await cursor.execute(schema_query, self.config.schema_names)
            else:
                # Get all schemas
                schema_query = """
                    SELECT DISTINCT schema_name
                    FROM information_schema.schemata
                    WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
                    AND schema_name NOT LIKE 'pg_%'
                    ORDER BY schema_name
                """
                await cursor.execute(schema_query)

            schema_rows = await cursor.fetchall()
            schema_names = [row["schema_name"] for row in schema_rows]

            schemas = []
            for schema_name in schema_names:
                tables = await self._get_tables_lite(conn, schema_name)
                if tables:  # Only include schemas with tables
                    schemas.append(SchemaMetadataLite(name=schema_name, tables=tables))

            return schemas

    async def _get_tables_lite(
        self, conn: psycopg.AsyncConnection, schema_name: str
    ) -> list[TableMetadataLite]:
        """Get all tables in a schema (names only).

        Args:
            conn: Active database connection
            schema_name: Schema name

        Returns:
            List of table names only
        """
        async with conn.cursor(row_factory=dict_row) as cursor:
            # Get all tables in the schema
            tables_query = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = %s
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """
            await cursor.execute(tables_query, (schema_name,))
            table_rows = await cursor.fetchall()

            tables = []
            for row in table_rows:
                table_name = row["table_name"]
                # Create lightweight table metadata (name only)
                tables.append(
                    TableMetadataLite(
                        name=table_name,
                        schema_name=schema_name,
                    )
                )

            return tables

    async def get_table_details(
        self, schema_name: str, table_name: str
    ) -> TableMetadata:
        """Get detailed metadata for a specific table.

        Args:
            schema_name: Schema name
            table_name: Table name

        Returns:
            Detailed table metadata with columns and row count
        """
        # Connect to PostgreSQL (async)
        conn_string = (
            f"host={self.config.host} "
            f"port={self.config.port} "
            f"dbname={self.config.database} "
            f"user={self.config.username} "
            f"password={self.config.password} "
            f"connect_timeout=10"
        )
        
        async with await psycopg.AsyncConnection.connect(conn_string) as conn:
            # Get column information
            columns = await self._get_columns(conn, schema_name, table_name)

            # Get row count
            try:
                count_query = f'SELECT COUNT(*) as count FROM "{schema_name}"."{table_name}"'
                async with conn.cursor(row_factory=dict_row) as cursor:
                    await cursor.execute(count_query)
                    result = await cursor.fetchone()
                    row_count = result["count"] if result else None
            except Exception as e:
                logger.warning(
                    f"Could not get row count for {schema_name}.{table_name}: {e}"
                )
                row_count = None

            return TableMetadata(
                name=table_name,
                schema_name=schema_name,
                columns=columns,
                row_count=row_count,
            )

    async def _get_columns(
        self, conn: psycopg.AsyncConnection, schema_name: str, table_name: str
    ) -> list[ColumnMetadata]:
        """Get column information for a table.

        Args:
            conn: Active database connection
            schema_name: Schema name
            table_name: Table name

        Returns:
            List of columns with metadata
        """
        async with conn.cursor(row_factory=dict_row) as cursor:
            # Get column information from information_schema
            columns_query = """
                SELECT
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
                FROM information_schema.columns c
                LEFT JOIN (
                    SELECT
                        kcu.column_name,
                        kcu.table_schema,
                        kcu.table_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                ) pk ON c.column_name = pk.column_name
                    AND c.table_schema = pk.table_schema
                    AND c.table_name = pk.table_name
                WHERE c.table_schema = %s
                AND c.table_name = %s
                ORDER BY c.ordinal_position
            """
            await cursor.execute(columns_query, (schema_name, table_name))
            rows = await cursor.fetchall()

            columns = []
            for row in rows:
                columns.append(
                    ColumnMetadata(
                        name=row["column_name"],
                        type=row["data_type"],
                        nullable=row["is_nullable"] == "YES",
                        is_primary_key=bool(row["is_primary_key"]),
                    )
                )

            return columns

