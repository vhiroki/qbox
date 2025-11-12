import uuid
from abc import ABC, abstractmethod
from typing import Any, Optional

import duckdb

from app.models.schemas import (
    ConnectionConfig,
    DataSourceType,
    PostgresConnectionConfig,
    TableSchema,
)
from app.services.connection_repository import connection_repository
from app.services.duckdb_manager import get_duckdb_manager
from app.services.query_repository import query_repository


class DataSource(ABC):
    """Abstract base class for data sources."""

    def __init__(self, connection_id: str, config: dict[str, Any]):
        self.connection_id = connection_id
        self.config = config
        self.duckdb_conn: Optional[duckdb.DuckDBPyConnection] = None

    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the data source."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to the data source."""
        pass

    @abstractmethod
    async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """Execute a query and return results."""
        pass

    @abstractmethod
    async def get_schema(self) -> list[TableSchema]:
        """Get schema information from the data source."""
        pass


class PostgresDataSource(DataSource):
    """PostgreSQL data source using DuckDB's postgres extension."""

    def __init__(self, connection_id: str, config: PostgresConnectionConfig):
        super().__init__(connection_id, config.model_dump())
        self.postgres_config = config

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


class ConnectionManager:
    """Manages data source connections."""

    def __init__(self):
        self.connections: dict[str, DataSource] = {}

    async def create_connection(
        self, config: ConnectionConfig, save: bool = True
    ) -> tuple[bool, str, str]:
        """
        Create a new connection.

        Args:
            config: Connection configuration
            save: Whether to save the connection to the repository

        Returns:
            tuple: (success, message, connection_id)
        """
        connection_id = str(uuid.uuid4())

        try:
            if config.type == DataSourceType.POSTGRES:
                postgres_config = PostgresConnectionConfig(**config.config)
                datasource = PostgresDataSource(connection_id, postgres_config)
            else:
                return False, f"Unsupported data source type: {config.type}", ""

            # Attempt to connect
            success = await datasource.connect()
            if not success:
                return False, "Failed to establish connection", ""

            # Store the connection in memory
            self.connections[connection_id] = datasource

            # Save to repository if requested
            if save:
                try:
                    connection_repository.save(connection_id, config)
                except ValueError as e:
                    # Validation error (e.g., duplicate alias)
                    # Disconnect the connection since we can't save it
                    await datasource.disconnect()
                    del self.connections[connection_id]
                    return False, str(e), ""

            return True, f"Successfully connected to {config.name}", connection_id

        except ValueError as e:
            # Validation errors from repository
            return False, str(e), ""
        except Exception as e:
            return False, f"Error creating connection: {str(e)}", ""

    async def reconnect(self, connection_id: str) -> tuple[bool, str]:
        """
        Reconnect to a saved connection.

        Returns:
            tuple: (success, message)
        """
        # Get config from repository
        config = connection_repository.get(connection_id)
        if not config:
            return False, "Connection configuration not found"

        try:
            if config.type == DataSourceType.POSTGRES:
                postgres_config = PostgresConnectionConfig(**config.config)
                datasource = PostgresDataSource(connection_id, postgres_config)
            else:
                return False, f"Unsupported data source type: {config.type}"

            # Attempt to connect
            success = await datasource.connect()
            if not success:
                return False, "Failed to establish connection"

            # Store the connection in memory
            self.connections[connection_id] = datasource

            return True, f"Successfully reconnected to {config.name}"

        except Exception as e:
            return False, f"Error reconnecting: {str(e)}"

    async def get_connection(self, connection_id: str) -> Optional[DataSource]:
        """Get an active connection by ID. Attempts to reconnect if not active."""
        datasource = self.connections.get(connection_id)

        # If not in memory, try to reconnect from saved config
        if not datasource and connection_repository.exists(connection_id):
            success, _ = await self.reconnect(connection_id)
            if success:
                datasource = self.connections.get(connection_id)

        return datasource

    async def disconnect(self, connection_id: str, delete_saved: bool = False) -> bool:
        """
        Disconnect and remove a connection.

        Args:
            connection_id: The connection ID to disconnect
            delete_saved: Whether to also delete the saved configuration
        
        Returns:
            True if the connection was found and disconnected
        """
        datasource = self.connections.get(connection_id)
        if datasource:
            await datasource.disconnect()
            del self.connections[connection_id]

        if delete_saved:
            # Detach from persistent DuckDB if attached
            duckdb_manager = get_duckdb_manager()
            duckdb_manager.detach_by_connection_id(connection_id)
            
            # Delete all query selections that reference this connection
            query_repository.delete_selections_by_connection(connection_id)
            
            # Delete the connection configuration
            connection_repository.delete(connection_id)

        return datasource is not None

    async def list_connections(self) -> list[dict[str, str]]:
        """List all active connections."""
        return [
            {"id": conn_id, "type": type(ds).__name__} for conn_id, ds in self.connections.items()
        ]

    def list_saved_connections(self) -> list[dict[str, Any]]:
        """List all saved connection configurations."""
        return connection_repository.get_all()

    def get_saved_connection(self, connection_id: str) -> Optional[dict[str, Any]]:
        """Get a saved connection configuration (without sensitive data like passwords)."""
        config = connection_repository.get(connection_id)
        if not config:
            return None

        # Return config without sensitive data
        safe_config = config.config.copy()
        if "password" in safe_config:
            safe_config["password"] = ""  # Don't expose password

        return {
            "id": connection_id,
            "name": config.name,
            "type": config.type.value,
            "config": safe_config,
            "alias": config.alias,
        }

    def update_saved_connection(
        self, connection_id: str, config: ConnectionConfig
    ) -> tuple[bool, str]:
        """Update a saved connection configuration."""
        existing = connection_repository.get(connection_id)
        if not existing:
            return False, "Connection not found"

        # If password is empty in the update, keep the existing one
        if "password" in config.config and not config.config["password"]:
            if "password" in existing.config:
                config.config["password"] = existing.config["password"]

        # Save the updated config
        try:
            connection_repository.save(connection_id, config)
        except ValueError as e:
            # Validation error (e.g., duplicate alias)
            return False, str(e)

        # If the connection is currently active, disconnect it
        # (it will need to be reconnected with the new config)
        if connection_id in self.connections:
            self.connections[connection_id].duckdb_conn = None
            del self.connections[connection_id]
        
        # Force detach from persistent DuckDB so it will be re-attached with new config
        duckdb_manager = get_duckdb_manager()
        duckdb_manager.detach_by_connection_id(connection_id)

        return True, "Connection updated successfully"


# Global connection manager instance
connection_manager = ConnectionManager()
