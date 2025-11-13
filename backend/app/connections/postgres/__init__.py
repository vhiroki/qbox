"""PostgreSQL connection module."""

from typing import Any, Optional

import duckdb

from app.connections import BaseConnection, ConnectionRegistry
from app.models.schemas import DataSourceType, PostgresConnectionConfig, TableSchema


@ConnectionRegistry.register(DataSourceType.POSTGRES)
class PostgresConnection(BaseConnection):
    """PostgreSQL data source using DuckDB's postgres extension."""

    def __init__(self, connection_id: str, connection_name: str, config: dict[str, Any]):
        super().__init__(connection_id, connection_name, config)
        # Parse and validate config using Pydantic
        self.postgres_config = PostgresConnectionConfig(**config)
        self.duckdb_conn: Optional[duckdb.DuckDBPyConnection] = None

    async def connect(self) -> bool:
        """Connect to PostgreSQL using DuckDB."""
        try:
            # Create a new DuckDB connection
            self.duckdb_conn = duckdb.connect(":memory:")

            # Install and load postgres extension
            self.duckdb_conn.execute("INSTALL postgres")
            self.duckdb_conn.execute("LOAD postgres")

            # Attach PostgreSQL database
            if self.postgres_config.schema_names and len(self.postgres_config.schema_names) == 1:
                # Single schema: use SCHEMA parameter
                attach_query = f"""
                    ATTACH 'host={self.postgres_config.host}
                    port={self.postgres_config.port}
                    dbname={self.postgres_config.database}
                    user={self.postgres_config.username}
                    password={self.postgres_config.password}'
                    AS pg (TYPE POSTGRES, SCHEMA '{self.postgres_config.schema_names[0]}')
                """
            else:
                # No schemas or multiple schemas: omit SCHEMA parameter
                attach_query = f"""
                    ATTACH 'host={self.postgres_config.host}
                    port={self.postgres_config.port}
                    dbname={self.postgres_config.database}
                    user={self.postgres_config.username}
                    password={self.postgres_config.password}'
                    AS pg (TYPE POSTGRES)
                """
            self.duckdb_conn.execute(attach_query)

            return True
        except Exception as e:
            self.connection_error = str(e)
            print(f"Failed to connect to PostgreSQL: {e}")
            return False

    async def disconnect(self) -> None:
        """Close DuckDB connection."""
        if self.duckdb_conn:
            self.duckdb_conn.close()
            self.duckdb_conn = None

    async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """Execute a SQL query."""
        if not self.duckdb_conn:
            raise RuntimeError("Not connected to database")

        result = self.duckdb_conn.execute(query)
        columns = [desc[0] for desc in result.description]
        rows = [dict(zip(columns, row)) for row in result.fetchall()]

        return columns, rows

    async def get_schema(self) -> list[TableSchema]:
        """Get schema information from PostgreSQL."""
        if not self.duckdb_conn:
            raise RuntimeError("Not connected to database")

        schema = self.postgres_config.schema_name or "public"

        # Query to get tables and their columns
        query = f"""
            SELECT
                table_name,
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns
            WHERE table_schema = '{schema}'
            ORDER BY table_name, ordinal_position
        """

        result = self.duckdb_conn.execute(query)
        rows = result.fetchall()

        # Group columns by table
        tables_dict: dict[str, list[dict[str, str]]] = {}
        for row in rows:
            table_name, column_name, data_type, is_nullable = row
            if table_name not in tables_dict:
                tables_dict[table_name] = []
            tables_dict[table_name].append(
                {
                    "name": column_name,
                    "type": data_type,
                    "nullable": "YES" if is_nullable == "YES" else "NO",
                }
            )

        # Create TableSchema objects with fully qualified names
        schemas = []
        for table_name, columns in tables_dict.items():
            # Get row count for each table
            try:
                count_result = self.duckdb_conn.execute(
                    f"SELECT COUNT(*) FROM pg.{schema}.{table_name}"
                )
                row_count = count_result.fetchone()[0]
            except Exception:
                row_count = None

            # Use fully qualified table name (pg.schema.table)
            full_table_name = f"pg.{schema}.{table_name}"
            schemas.append(
                TableSchema(
                    table_name=full_table_name,
                    columns=columns,
                    row_count=row_count,
                )
            )

        return schemas

    async def cleanup(self, duckdb_manager) -> None:
        """Cleanup PostgreSQL connection from DuckDB."""
        # For PostgreSQL, we detach from the persistent DuckDB instance
        duckdb_manager.detach_by_connection_id(self.connection_id, DataSourceType.POSTGRES)

