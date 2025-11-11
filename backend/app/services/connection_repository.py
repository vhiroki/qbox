import json
import sqlite3
from pathlib import Path
from typing import Any, Optional

from app.models.schemas import ConnectionConfig, DataSourceType


class ConnectionRepository:
    """Repository for persisting connection configurations."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Store in user's home directory or use a data directory
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "connections.db"

        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the database schema."""
        with sqlite3.connect(self.db_path) as conn:
            # Create table without alias initially (for backward compatibility)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    config TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            )
            
            # Migration: Add alias column if it doesn't exist
            try:
                conn.execute("ALTER TABLE connections ADD COLUMN alias TEXT")
            except sqlite3.OperationalError:
                pass  # Column already exists
            
            # Create indexes after column exists
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_connections_name 
                ON connections(name)
            """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_alias 
                ON connections(alias) WHERE alias IS NOT NULL
            """
            )
            conn.commit()

    def save(self, connection_id: str, config: ConnectionConfig) -> None:
        """Save or update a connection configuration."""
        # Check if this is an update (connection already exists)
        existing = self.get(connection_id)
        
        # Validate alias uniqueness if provided
        if config.alias:
            if not self._is_alias_valid(config.alias):
                raise ValueError(
                    "Invalid alias. Must be alphanumeric with underscores, "
                    "start with a letter, and be 3-50 characters long."
                )
            if not self._is_alias_unique(config.alias, connection_id):
                raise ValueError(f"Alias '{config.alias}' is already in use by another connection.")
        
        # Prevent alias changes on existing connections
        if existing and existing.alias and existing.alias != config.alias:
            raise ValueError(
                "Cannot change alias after connection creation. "
                "This would break existing queries that reference the connection."
            )
        
        with sqlite3.connect(self.db_path) as conn:
            if existing:
                # Update existing connection - preserve alias
                conn.execute(
                    """
                    UPDATE connections 
                    SET name = ?, type = ?, config = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        config.name,
                        config.type.value,
                        json.dumps(config.config),
                        connection_id,
                    ),
                )
            else:
                # Insert new connection - allow alias
                conn.execute(
                    """
                    INSERT INTO connections (id, name, type, config, alias, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        connection_id,
                        config.name,
                        config.type.value,
                        json.dumps(config.config),
                        config.alias,
                    ),
                )
            conn.commit()

    def get(self, connection_id: str) -> Optional[ConnectionConfig]:
        """Get a connection configuration by ID."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT name, type, config, alias FROM connections WHERE id = ?",
                (connection_id,),
            )
            row = cursor.fetchone()

            if row:
                return ConnectionConfig(
                    name=row["name"],
                    type=DataSourceType(row["type"]),
                    config=json.loads(row["config"]),
                    alias=row["alias"],
                )
            return None

    def get_all(self) -> list[dict[str, Any]]:
        """Get all saved connections (without sensitive data)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, type, alias, created_at, updated_at 
                FROM connections 
                ORDER BY updated_at DESC
                """
            )
            return [dict(row) for row in cursor.fetchall()]

    def delete(self, connection_id: str) -> bool:
        """Delete a connection configuration."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM connections WHERE id = ?", (connection_id,))
            conn.commit()
            return cursor.rowcount > 0

    def exists(self, connection_id: str) -> bool:
        """Check if a connection exists."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT 1 FROM connections WHERE id = ?", (connection_id,))
            return cursor.fetchone() is not None

    def _is_alias_valid(self, alias: str) -> bool:
        """Validate alias format: alphanumeric + underscores, start with letter, 3-50 chars."""
        import re
        # Must start with letter, contain only alphanumeric and underscores, 3-50 chars
        pattern = r'^[a-zA-Z][a-zA-Z0-9_]{2,49}$'
        return bool(re.match(pattern, alias))

    def _is_alias_unique(self, alias: str, exclude_connection_id: Optional[str] = None) -> bool:
        """Check if alias is unique across all connections."""
        with sqlite3.connect(self.db_path) as conn:
            if exclude_connection_id:
                cursor = conn.execute(
                    "SELECT 1 FROM connections WHERE alias = ? AND id != ?",
                    (alias, exclude_connection_id),
                )
            else:
                cursor = conn.execute(
                    "SELECT 1 FROM connections WHERE alias = ?",
                    (alias,),
                )
            return cursor.fetchone() is None


# Global repository instance
connection_repository = ConnectionRepository()
