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

        # Extensions: postgres for PostgreSQL, httpfs for S3, spatial for Excel
        extensions = ["postgres", "httpfs", "spatial"]

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

    def register_file(self, file_id: str, file_name: str, file_path: str, file_type: str) -> str:
        """Register a CSV or Excel file as a view in DuckDB.
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name to use for the view (without extension)
            file_path: Path to the file
            file_type: Type of file ('csv' or 'xlsx')
            
        Returns:
            The view name that was created
        """
        conn = self.connect()
        
        # Create human-readable view name from file name
        # Sanitize the name: lowercase, replace spaces/special chars with underscores
        import re
        sanitized_name = re.sub(r'[^a-z0-9]+', '_', file_name.lower())
        sanitized_name = sanitized_name.strip('_')
        
        # Ensure it doesn't start with a digit
        if sanitized_name and sanitized_name[0].isdigit():
            sanitized_name = f"file_{sanitized_name}"
        else:
            sanitized_name = f"file_{sanitized_name}"
        
        # Check if the view name already exists using information_schema
        view_name = sanitized_name
        
        try:
            # Drop view if it exists (shouldn't happen but be safe)
            try:
                conn.execute(f"DROP VIEW IF EXISTS {view_name}")
            except Exception:
                pass
            
            # Create view based on file type
            if file_type == "csv":
                # Use read_csv_auto for automatic type detection
                create_view_query = f"""
                    CREATE VIEW {view_name} AS 
                    SELECT * FROM read_csv_auto('{file_path}', header=true)
                """
            elif file_type == "xlsx":
                # Use st_read for Excel files (requires spatial extension)
                create_view_query = f"""
                    CREATE VIEW {view_name} AS 
                    SELECT * FROM st_read('{file_path}', layer='', open_options=['HEADERS=FORCE'])
                """
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            conn.execute(create_view_query)
            logger.info(f"Registered {file_type} file as view: {view_name}")
            return view_name
            
        except Exception as e:
            logger.error(f"Failed to register file {file_id}: {e}")
            raise

    def get_file_view_name(self, file_id: str, file_name: str) -> str:
        """Get the view name for a registered file (fallback for old files).
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name of the file (used to generate the view name)
            
        Returns:
            The view name that was created
        """
        # Generate the view name using the same logic as register_file
        import re
        sanitized_name = re.sub(r'[^a-z0-9]+', '_', file_name.lower())
        sanitized_name = sanitized_name.strip('_')
        
        if sanitized_name and sanitized_name[0].isdigit():
            sanitized_name = f"file_{sanitized_name}"
        else:
            sanitized_name = f"file_{sanitized_name}"
        
        # Try without suffix first
        if self.conn:
            try:
                self.conn.execute(f"SELECT 1 FROM {sanitized_name} LIMIT 0")
                return sanitized_name
            except Exception:
                pass
        
        # Fall back to with suffix
        suffix = file_id.replace('-', '')[:8]
        view_name = f"{sanitized_name}_{suffix}"
        
        return view_name

    def unregister_file(self, file_id: str, file_name: str) -> None:
        """Unregister a file from DuckDB (fallback for old files).
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name of the file (used to generate the view name)
        """
        if not self.conn:
            return
        
        # Get the view name using the same logic as register_file
        view_name = self.get_file_view_name(file_id, file_name)
        self.unregister_file_by_view_name(view_name)
    
    def unregister_file_by_view_name(self, view_name: str) -> None:
        """Unregister a file from DuckDB by view name.
        
        Args:
            view_name: The view name to drop
        """
        if not self.conn:
            return
        
        try:
            self.conn.execute(f"DROP VIEW IF EXISTS {view_name}")
            logger.info(f"Unregistered file view: {view_name}")
        except Exception as e:
            logger.warning(f"Could not unregister view {view_name}: {e}")

    def get_file_metadata(self, file_id: str, file_name: str) -> dict[str, Any]:
        """Get metadata for a registered file (fallback for old files).
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name of the file (used to generate the view name)
            
        Returns:
            Dictionary containing columns and row count
        """
        view_name = self.get_file_view_name(file_id, file_name)
        return self.get_file_metadata_by_view_name(view_name)
    
    def get_file_metadata_by_view_name(self, view_name: str) -> dict[str, Any]:
        """Get metadata for a registered file by view name.
        
        Args:
            view_name: The view name to get metadata for
            
        Returns:
            Dictionary containing columns and row count
        """
        from app.models.schemas import ColumnMetadata
        
        conn = self.connect()
        
        try:
            # Get column information
            column_query = f"DESCRIBE {view_name}"
            result = conn.execute(column_query)
            columns_data = result.fetchall()
            
            columns = [
                ColumnMetadata(
                    name=col[0],
                    type=col[1],
                    nullable=col[2] == "YES" if len(col) > 2 else True,
                    is_primary_key=False,
                )
                for col in columns_data
            ]
            
            # Get row count
            count_query = f"SELECT COUNT(*) FROM {view_name}"
            count_result = conn.execute(count_query)
            row_count = count_result.fetchone()[0]
            
            return {
                "columns": columns,
                "row_count": row_count,
            }
            
        except Exception as e:
            logger.error(f"Failed to get file metadata for {view_name}: {e}")
            raise

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
