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
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_connections_name 
                ON connections(name)
            """
            )
            conn.commit()

    def save(self, connection_id: str, config: ConnectionConfig) -> None:
        """Save or update a connection configuration."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO connections (id, name, type, config, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    type = excluded.type,
                    config = excluded.config,
                    updated_at = CURRENT_TIMESTAMP
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


# Global repository instance
connection_repository = ConnectionRepository()
