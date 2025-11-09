"""Repository for persisting workspace table selections."""

import sqlite3
from pathlib import Path
from typing import Optional

from app.models.schemas import WorkspaceTableSelection


class WorkspaceRepository:
    """Repository for workspace selections persistence."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Use same directory as connections database
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "workspace.db"

        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspace_selections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id TEXT NOT NULL,
                    schema_name TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(connection_id, schema_name, table_name)
                )
            """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_workspace_connection
                ON workspace_selections(connection_id)
            """
            )
            conn.commit()

    def add_selection(self, connection_id: str, schema_name: str, table_name: str) -> None:
        """Add a table to workspace selections."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO workspace_selections
                (connection_id, schema_name, table_name)
                VALUES (?, ?, ?)
                """,
                (connection_id, schema_name, table_name),
            )
            conn.commit()

    def remove_selection(self, connection_id: str, schema_name: str, table_name: str) -> None:
        """Remove a table from workspace selections."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                DELETE FROM workspace_selections
                WHERE connection_id = ?
                AND schema_name = ?
                AND table_name = ?
                """,
                (connection_id, schema_name, table_name),
            )
            conn.commit()

    def get_all_selections(self) -> list[WorkspaceTableSelection]:
        """Get all workspace selections."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT connection_id, schema_name, table_name
                FROM workspace_selections
                ORDER BY created_at ASC
                """
            )
            rows = cursor.fetchall()
            return [
                WorkspaceTableSelection(
                    connection_id=row["connection_id"],
                    schema_name=row["schema_name"],
                    table_name=row["table_name"],
                )
                for row in rows
            ]

    def clear_all(self) -> None:
        """Clear all workspace selections."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM workspace_selections")
            conn.commit()

    def clear_by_connection(self, connection_id: str) -> None:
        """Clear all selections for a specific connection."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                DELETE FROM workspace_selections
                WHERE connection_id = ?
                """,
                (connection_id,),
            )
            conn.commit()


# Global workspace repository instance
workspace_repository = WorkspaceRepository()
