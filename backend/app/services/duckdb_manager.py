"""Persistent DuckDB instance manager for QBox."""

import logging
import re
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

    def _sanitize_alias(self, name: str, connection_id: str) -> str:
        """Create a valid SQL identifier from connection name.
        
        Args:
            name: The connection name
            connection_id: The connection ID (used for uniqueness suffix)
            
        Returns:
            A valid SQL identifier like 'pg_production_db'
        """
        # Convert to lowercase and replace spaces/special chars with underscores
        sanitized = re.sub(r'[^a-z0-9]+', '_', name.lower())
        
        # Remove leading/trailing underscores
        sanitized = sanitized.strip('_')
        
        # Ensure it doesn't start with a digit
        if sanitized and sanitized[0].isdigit():
            sanitized = f"db_{sanitized}"
        
        # Add short unique suffix from connection_id (first 8 chars)
        # This prevents collisions if two connections have similar names
        suffix = connection_id.replace('-', '')[:8]
        
        # Combine with pg_ prefix
        alias = f"pg_{sanitized}_{suffix}"
        
        return alias

    def attach_postgres(
        self,
        connection_id: str,
        connection_name: str,
        config: PostgresConnectionConfig,
        custom_alias: Optional[str] = None,
    ) -> str:
        """Attach a PostgreSQL database to DuckDB.

        Args:
            connection_id: Unique identifier for this connection
            connection_name: Human-readable name for the connection
            config: PostgreSQL connection configuration
            custom_alias: Optional custom alias (if set by user)
                         Falls back to auto-generated from connection_name

        Returns:
            The alias used for the attachment
        """
        conn = self.connect()
        # Use custom alias if provided, otherwise generate from connection name
        if custom_alias:
            alias = f"pg_{custom_alias}"
        else:
            alias = self._sanitize_alias(connection_name, connection_id)

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
