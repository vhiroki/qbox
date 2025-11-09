"""Persistent DuckDB instance manager for QBox."""

import logging
from pathlib import Path
from typing import Any, Optional

import duckdb

from app.models.schemas import PostgresConnectionConfig

logger = logging.getLogger(__name__)


class DuckDBManager:
    """Manages a persistent DuckDB instance for cross-source querying."""

    def __init__(self, db_path: Optional[Path] = None):
        """Initialize DuckDB manager with persistent database file."""
        if db_path is None:
            # Store in user's home directory
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "qbox.duckdb"

        self.db_path = db_path
        self.conn: Optional[duckdb.DuckDBPyConnection] = None
        logger.info(f"DuckDB database path: {self.db_path}")

    def connect(self) -> duckdb.DuckDBPyConnection:
        """Get or create persistent DuckDB connection."""
        if self.conn is None:
            self.conn = duckdb.connect(str(self.db_path))
            self._install_extensions()
            logger.info("Connected to persistent DuckDB instance")
        return self.conn

    def _install_extensions(self) -> None:
        """Install and load necessary DuckDB extensions."""
        if not self.conn:
            return

        extensions = ["postgres", "httpfs"]  # httpfs for S3 support later

        for ext in extensions:
            try:
                self.conn.execute(f"INSTALL {ext}")
                self.conn.execute(f"LOAD {ext}")
                logger.info(f"Loaded DuckDB extension: {ext}")
            except Exception as e:
                logger.warning(f"Could not load extension {ext}: {e}")

    def attach_postgres(
        self,
        connection_id: str,
        config: PostgresConnectionConfig,
        alias: Optional[str] = None,
    ) -> str:
        """Attach a PostgreSQL database to DuckDB.

        Args:
            connection_id: Unique identifier for this connection
            config: PostgreSQL connection configuration
            alias: Optional alias for the attachment
                   (defaults to 'pg_' + connection_id)

        Returns:
            The alias used for the attachment
        """
        conn = self.connect()
        # Prefix with 'pg_' to ensure valid identifier (can't start with digit)
        alias = alias or f"pg_{connection_id.replace('-', '_')}"

        # Detach if already exists
        try:
            conn.execute(f"DETACH {alias}")
        except Exception:
            pass  # Ignore if doesn't exist

        # Attach PostgreSQL database
        attach_query = f"""
            ATTACH 'host={config.host}
            port={config.port}
            dbname={config.database}
            user={config.username}
            password={config.password}'
            AS {alias} (TYPE POSTGRES, SCHEMA '{config.schema_name}')
        """

        try:
            conn.execute(attach_query)
            logger.info(f"Attached PostgreSQL database as '{alias}'")
            return alias
        except Exception as e:
            logger.error(f"Failed to attach PostgreSQL: {e}")
            raise

    def detach_source(self, alias: str) -> None:
        """Detach a data source from DuckDB."""
        if not self.conn:
            return

        try:
            self.conn.execute(f"DETACH {alias}")
            logger.info(f"Detached source: {alias}")
        except Exception as e:
            logger.warning(f"Could not detach {alias}: {e}")

    def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
        """Execute a SQL query on the DuckDB instance.

        Returns:
            Tuple of (column_names, rows)
        """
        conn = self.connect()

        try:
            result = conn.execute(query)
            columns = [desc[0] for desc in result.description]
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            return columns, rows
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def get_attached_sources(self) -> list[dict[str, str]]:
        """Get list of currently attached data sources."""
        conn = self.connect()

        try:
            result = conn.execute("SHOW DATABASES")
            databases = result.fetchall()
            return [{"name": db[0]} for db in databases]
        except Exception as e:
            logger.error(f"Failed to get attached sources: {e}")
            return []

    def close(self) -> None:
        """Close the DuckDB connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
            logger.info("Closed DuckDB connection")


# Global DuckDB manager instance
_duckdb_manager: Optional[DuckDBManager] = None


def get_duckdb_manager() -> DuckDBManager:
    """Get or create the global DuckDB manager instance."""
    global _duckdb_manager
    if _duckdb_manager is None:
        _duckdb_manager = DuckDBManager()
    return _duckdb_manager
