import json
import re
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
            # Create connections table with all columns
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    config TEXT NOT NULL,
                    alias TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            )
            
            # Create indexes
            # Add unique constraint on connection name
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_name_unique
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

        # Check for identifier collision (sanitized name conflict)
        conflicting_name = self.check_identifier_collision(config.name, connection_id)
        if conflicting_name:
            sanitized_id = self._sanitize_identifier(config.name)
            raise ValueError(
                f"Connection identifier '{sanitized_id}' conflicts with existing connection '{conflicting_name}'. "
                f"Please choose a different name."
            )
        
        with sqlite3.connect(self.db_path) as conn:
            if existing:
                # Update existing connection
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
                # Insert new connection (no alias needed)
                conn.execute(
                    """
                    INSERT INTO connections (id, name, type, config, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        connection_id,
                        config.name,
                        config.type.value,
                        json.dumps(config.config),
                    ),
                )
            conn.commit()

    def get(self, connection_id: str) -> Optional[ConnectionConfig]:
        """Get a connection configuration by ID."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT name, type, config FROM connections WHERE id = ?",
                (connection_id,),
            )
            row = cursor.fetchone()

            if row:
                return ConnectionConfig(
                    name=row["name"],
                    type=DataSourceType(row["type"]),
                    config=json.loads(row["config"]),
                )
            return None

    def get_all(self) -> list[dict[str, Any]]:
        """Get all saved connections (without sensitive data)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, type, created_at, updated_at
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

    def _sanitize_identifier(self, name: str) -> str:
        """Sanitize connection name to a valid DuckDB identifier.

        This must match the logic in DuckDBManager._generate_duckdb_identifier()
        to ensure collision detection works correctly.
        """
        # Convert to lowercase and replace spaces/special chars with underscores
        sanitized = re.sub(r'[^a-z0-9]+', '_', name.lower())

        # Remove leading/trailing underscores
        sanitized = sanitized.strip('_')

        # Ensure it doesn't start with a digit
        if sanitized and sanitized[0].isdigit():
            sanitized = f"db_{sanitized}"

        # Truncate to reasonable length (50 chars)
        if len(sanitized) > 50:
            sanitized = sanitized[:50].rstrip('_')

        return sanitized

    def check_identifier_collision(self, connection_name: str, exclude_id: Optional[str] = None) -> Optional[str]:
        """Check if sanitized identifier would conflict with existing connections.

        Args:
            connection_name: The connection name to check
            exclude_id: Optional connection ID to exclude from check (for updates)

        Returns:
            Name of conflicting connection if collision detected, None otherwise
        """
        proposed_identifier = self._sanitize_identifier(connection_name)

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            # Get all connections except the one being updated
            if exclude_id:
                cursor = conn.execute(
                    "SELECT name FROM connections WHERE id != ?",
                    (exclude_id,),
                )
            else:
                cursor = conn.execute("SELECT name FROM connections")

            for row in cursor.fetchall():
                existing_identifier = self._sanitize_identifier(row["name"])
                if existing_identifier == proposed_identifier:
                    return row["name"]

        return None


# Global repository instance
connection_repository = ConnectionRepository()
