"""Persistent DuckDB instance manager for QBox."""

import logging
import re
from pathlib import Path
from typing import Any, Optional

import duckdb

from app.models.schemas import PostgresConnectionConfig, S3ConnectionConfig, DataSourceType

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
        # Cache of attached connections: {connection_id: alias}
        self._attached_connections: dict[str, str] = {}
        # Cache of registered files: {file_id: view_name}
        self._registered_files: dict[str, str] = {}
        logger.info(f"DuckDB database path: {self.db_path}")

    def connect(self) -> duckdb.DuckDBPyConnection:
        """Get or create persistent DuckDB connection."""
        if self.conn is None:
            self.conn = duckdb.connect(str(self.db_path))
            self._install_extensions()
            self._sync_cache_with_duckdb()
            logger.info("Connected to persistent DuckDB instance")
        return self.conn
    
    def _sync_cache_with_duckdb(self) -> None:
        """Sync the attachment cache with actual DuckDB state.
        
        This is called on connection to populate the cache with any
        connections that were already attached in the persistent database.
        """
        if not self.conn:
            return
        
        try:
            # Get all currently attached databases
            result = self.conn.execute("SELECT database_name FROM duckdb_databases()")
            databases = result.fetchall()
            
            # Filter for postgres connections (start with pg_)
            for (db_name,) in databases:
                if db_name.startswith('pg_') and db_name != 'pg_catalog':
                    # We can't reconstruct the original connection_id reliably from alias alone
                    # So we'll just log that connections exist, but won't add to cache
                    # The cache will be populated as connections are used
                    logger.debug(f"Found existing attached database: {db_name}")
            
            # Note: For files (views), we'd need to query duckdb_views()
            # But views are cheap to recreate, so we'll let them be re-registered as needed
            
        except Exception as e:
            logger.warning(f"Could not sync cache with DuckDB state: {e}")

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

    def _sanitize_alias(self, name: str, connection_id: str, connection_type: DataSourceType) -> str:
        """Create a valid SQL identifier from connection name with type-based prefix.
        
        Args:
            name: The connection name
            connection_id: The connection ID (used for uniqueness suffix)
            connection_type: The type of connection (determines prefix)
            
        Returns:
            A valid SQL identifier like 'pg_production_db' or 's3_data_bucket'
        """
        # Map connection types to prefixes
        prefix_map = {
            DataSourceType.POSTGRES: "pg",
            DataSourceType.S3: "s3",
            DataSourceType.MYSQL: "mysql",
            DataSourceType.ORACLE: "oracle",
            DataSourceType.DYNAMODB: "dynamodb",
        }
        prefix = prefix_map.get(connection_type, "db")
        
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
        
        # Combine with type-specific prefix
        alias = f"{prefix}_{sanitized}_{suffix}"
        
        return alias

    def is_attached(self, connection_id: str) -> bool:
        """Check if a connection is already attached.
        
        Args:
            connection_id: Unique identifier for the connection
            
        Returns:
            True if connection is attached, False otherwise
        """
        return connection_id in self._attached_connections
    
    def get_attached_alias(self, connection_id: str) -> Optional[str]:
        """Get the alias for an attached connection.
        
        Args:
            connection_id: Unique identifier for the connection
            
        Returns:
            The alias if attached, None otherwise
        """
        return self._attached_connections.get(connection_id)
    
    def remove_connection_from_cache(self, connection_id: str) -> None:
        """Remove a connection from the internal cache.
        
        This should be called by connection cleanup methods after they've
        performed their cleanup operations (detach/drop secret).
        
        Args:
            connection_id: Connection identifier to remove from cache
        """
        if connection_id in self._attached_connections:
            del self._attached_connections[connection_id]

    def attach_postgres(
        self,
        connection_id: str,
        connection_name: str,
        config: PostgresConnectionConfig,
        custom_alias: Optional[str] = None,
        force_reattach: bool = False,
    ) -> str:
        """Attach a PostgreSQL database to DuckDB (idempotent).

        Args:
            connection_id: Unique identifier for this connection
            connection_name: Human-readable name for the connection
            config: PostgreSQL connection configuration
            custom_alias: Optional custom alias (if set by user)
                         Falls back to auto-generated from connection_name
            force_reattach: If True, detaches and re-attaches even if already attached

        Returns:
            The alias used for the attachment
        """
        # Check if already attached (unless forced to reattach)
        if not force_reattach and connection_id in self._attached_connections:
            cached_alias = self._attached_connections[connection_id]
            logger.debug(f"Connection {connection_id} already attached as '{cached_alias}'")
            return cached_alias
        
        conn = self.connect()
        # Use custom alias if provided, otherwise generate from connection name
        if custom_alias:
            alias = f"pg_{custom_alias}"
        else:
            alias = self._sanitize_alias(connection_name, connection_id, DataSourceType.POSTGRES)

        # Detach if already exists (in case of reattach or stale state)
        try:
            conn.execute(f"DETACH {alias}")
            logger.debug(f"Detached existing connection: {alias}")
        except Exception:
            pass  # Ignore if doesn't exist

        # Attach PostgreSQL database
        # Note: SCHEMA parameter in ATTACH is optional
        # If multiple schemas are specified, we omit it and filter in metadata service
        if config.schema_names and len(config.schema_names) == 1:
            # Single schema: use SCHEMA parameter for potential optimization
            attach_query = f"""
                ATTACH 'host={config.host}
                port={config.port}
                dbname={config.database}
                user={config.username}
                password={config.password}'
                AS {alias} (TYPE POSTGRES, SCHEMA '{config.schema_names[0]}')
            """
        else:
            # No schemas or multiple schemas: omit SCHEMA parameter to get all
            attach_query = f"""
                ATTACH 'host={config.host}
                port={config.port}
                dbname={config.database}
                user={config.username}
                password={config.password}'
                AS {alias} (TYPE POSTGRES)
            """

        try:
            conn.execute(attach_query)
            # Cache the attachment
            self._attached_connections[connection_id] = alias
            logger.info(f"Attached PostgreSQL database as '{alias}' (cached)")
            return alias
        except Exception as e:
            logger.error(f"Failed to attach PostgreSQL: {e}")
            raise

    def configure_s3_secret(
        self,
        connection_id: str,
        connection_name: str,
        config: S3ConnectionConfig,
        custom_alias: Optional[str] = None,
        force_recreate: bool = False,
    ) -> str:
        """Configure S3 credentials as a DuckDB secret.

        Args:
            connection_id: Unique identifier for this connection
            connection_name: Human-readable name for the connection
            config: S3 configuration
            custom_alias: Optional custom alias (if set by user)
                         Falls back to auto-generated from connection_name
            force_recreate: If True, drops and recreates the secret even if it exists

        Returns:
            The secret name that was created
        """
        # Check if already configured (unless forced to recreate)
        if not force_recreate and connection_id in self._attached_connections:
            cached_secret = self._attached_connections[connection_id]
            logger.debug(f"S3 secret for connection {connection_id} already exists: '{cached_secret}'")
            return cached_secret
        
        conn = self.connect()
        # Use custom alias if provided, otherwise generate from connection name
        if custom_alias:
            secret_name = f"s3_{custom_alias}"
        else:
            secret_name = self._sanitize_alias(connection_name, connection_id, DataSourceType.S3)

        # Drop secret if it exists (in case of recreate)
        try:
            conn.execute(f"DROP SECRET IF EXISTS {secret_name}")
            logger.debug(f"Dropped existing secret: {secret_name}")
        except Exception:
            pass  # Ignore errors

        # Create S3 secret based on credential type
        try:
            if config.credential_type == "manual":
                # Create secret with explicit credentials
                create_secret_query = f"""
                    CREATE SECRET {secret_name} (
                        TYPE S3,
                        KEY_ID '{config.aws_access_key_id}',
                        SECRET '{config.aws_secret_access_key}',
                        REGION '{config.region or 'us-east-1'}'
                    )
                """
                # Add session token if provided
                if config.aws_session_token:
                    create_secret_query = f"""
                        CREATE SECRET {secret_name} (
                            TYPE S3,
                            KEY_ID '{config.aws_access_key_id}',
                            SECRET '{config.aws_secret_access_key}',
                            SESSION_TOKEN '{config.aws_session_token}',
                            REGION '{config.region or 'us-east-1'}'
                        )
                    """
                logger.debug(f"Creating S3 secret with manual credentials: {secret_name}")
            else:
                # Use default credential provider chain
                create_secret_query = f"""
                    CREATE SECRET {secret_name} (
                        TYPE S3,
                        PROVIDER CREDENTIAL_CHAIN,
                        REGION '{config.region or 'us-east-1'}'
                    )
                """
                logger.debug(f"Creating S3 secret with credential chain: {secret_name}")
            
            conn.execute(create_secret_query)
            # Cache the secret name
            self._attached_connections[connection_id] = secret_name
            logger.info(f"Created S3 secret: '{secret_name}' (cached)")
            return secret_name
        except Exception as e:
            logger.error(f"Failed to create S3 secret: {e}")
            raise

    def detach_by_connection_id(self, connection_id: str, connection_type: DataSourceType) -> None:
        """Detach/cleanup a connection by its connection_id.
        
        DEPRECATED: This method is deprecated. Connection types should call
        cleanup methods directly (detach_source/drop_secret) and then call
        remove_connection_from_cache.
        
        Args:
            connection_id: Unique identifier for the connection
            connection_type: Type of connection (ignored, for backward compatibility)
        """
        logger.warning(
            "detach_by_connection_id is deprecated. "
            "Connection types should handle cleanup directly."
        )
        if connection_id in self._attached_connections:
            del self._attached_connections[connection_id]
    
    def detach_source(self, alias: str) -> None:
        """Detach a data source from DuckDB by alias and remove from cache."""
        if not self.conn:
            return

        try:
            self.conn.execute(f"DETACH {alias}")
            # Remove from cache
            connection_id_to_remove = None
            for conn_id, cached_alias in self._attached_connections.items():
                if cached_alias == alias:
                    connection_id_to_remove = conn_id
                    break
            if connection_id_to_remove:
                del self._attached_connections[connection_id_to_remove]
            logger.info(f"Detached source: {alias}")
        except Exception as e:
            logger.warning(f"Could not detach {alias}: {e}")
    
    def drop_secret(self, secret_name: str) -> None:
        """Drop a DuckDB secret and remove from cache."""
        if not self.conn:
            return

        try:
            self.conn.execute(f"DROP SECRET IF EXISTS {secret_name}")
            # Remove from cache
            connection_id_to_remove = None
            for conn_id, cached_secret in self._attached_connections.items():
                if cached_secret == secret_name:
                    connection_id_to_remove = conn_id
                    break
            if connection_id_to_remove:
                del self._attached_connections[connection_id_to_remove]
            logger.info(f"Dropped secret: {secret_name}")
        except Exception as e:
            logger.warning(f"Could not drop secret {secret_name}: {e}")

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
        """Register a CSV or Excel file as a view in DuckDB (idempotent).
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name to use for the view (without extension)
            file_path: Path to the file
            file_type: Type of file ('csv' or 'xlsx')
            
        Returns:
            The view name that was created
        """
        # Check if already registered
        if file_id in self._registered_files:
            cached_view = self._registered_files[file_id]
            logger.debug(f"File {file_id} already registered as view '{cached_view}'")
            return cached_view
        
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
            # Cache the registration
            self._registered_files[file_id] = view_name
            logger.info(f"Registered {file_type} file as view: {view_name} (cached)")
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
        """Unregister a file from DuckDB and remove from cache.
        
        Args:
            file_id: Unique identifier for the file
            file_name: Name of the file (used to generate the view name)
        """
        if not self.conn:
            return
        
        # Get the view name using the same logic as register_file
        view_name = self.get_file_view_name(file_id, file_name)
        self.unregister_file_by_view_name(view_name)
        # Remove from cache
        if file_id in self._registered_files:
            del self._registered_files[file_id]
    
    def unregister_file_by_view_name(self, view_name: str) -> None:
        """Unregister a file from DuckDB by view name and remove from cache.
        
        Args:
            view_name: The view name to drop
        """
        if not self.conn:
            return
        
        try:
            self.conn.execute(f"DROP VIEW IF EXISTS {view_name}")
            # Remove from cache by view name
            file_id_to_remove = None
            for fid, cached_view in self._registered_files.items():
                if cached_view == view_name:
                    file_id_to_remove = fid
                    break
            if file_id_to_remove:
                del self._registered_files[file_id_to_remove]
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
        """Close the DuckDB connection and clear caches."""
        if self.conn:
            self.conn.close()
            self.conn = None
            # Clear caches since connection is closed
            self._attached_connections.clear()
            self._registered_files.clear()
            logger.info("Closed DuckDB connection and cleared caches")


# Global DuckDB manager instance
_duckdb_manager: Optional[DuckDBManager] = None


def get_duckdb_manager() -> DuckDBManager:
    """Get or create the global DuckDB manager instance."""
    global _duckdb_manager
    if _duckdb_manager is None:
        _duckdb_manager = DuckDBManager()
    return _duckdb_manager
