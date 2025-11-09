"""Repository for persisting workspaces and their table selections."""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.models.schemas import Workspace, WorkspaceTableSelection


class WorkspaceRepository:
    """Repository for workspace and table selections persistence."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Use same directory as connections database
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "connections.db"  # Use same database

        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the database schema."""
        with sqlite3.connect(self.db_path) as conn:
            # Workspaces table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Workspace selections table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS workspace_selections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workspace_id TEXT NOT NULL,
                    connection_id TEXT NOT NULL,
                    schema_name TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(workspace_id, connection_id, schema_name, table_name),
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                )
            """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_workspace_selections
                ON workspace_selections(workspace_id)
            """
            )
            conn.commit()

    # Workspace CRUD operations

    def create_workspace(self, name: str) -> Workspace:
        """Create a new workspace."""
        workspace_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO workspaces (id, name, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (workspace_id, name, now, now),
            )
            conn.commit()

        return Workspace(id=workspace_id, name=name, created_at=now, updated_at=now)

    def get_all_workspaces(self) -> list[Workspace]:
        """Get all workspaces, ordered by newest first."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, created_at, updated_at
                FROM workspaces
                ORDER BY created_at DESC
                """
            )
            rows = cursor.fetchall()

            return [
                Workspace(
                    id=row["id"],
                    name=row["name"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in rows
            ]

    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        """Get a workspace by ID."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, created_at, updated_at
                FROM workspaces
                WHERE id = ?
                """,
                (workspace_id,),
            )
            row = cursor.fetchone()

            if row:
                return Workspace(
                    id=row["id"],
                    name=row["name"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            return None

    def update_workspace(self, workspace_id: str, name: str) -> Optional[Workspace]:
        """Update a workspace name."""
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE workspaces
                SET name = ?, updated_at = ?
                WHERE id = ?
                """,
                (name, now, workspace_id),
            )
            conn.commit()

        return self.get_workspace(workspace_id)

    def delete_workspace(self, workspace_id: str) -> bool:
        """Delete a workspace and all its selections."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                DELETE FROM workspaces
                WHERE id = ?
                """,
                (workspace_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    # Table selection operations

    def add_selection(
        self, workspace_id: str, connection_id: str, schema_name: str, table_name: str
    ) -> None:
        """Add a table to workspace selections."""
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO workspace_selections
                (workspace_id, connection_id, schema_name, table_name)
                VALUES (?, ?, ?, ?)
                """,
                (workspace_id, connection_id, schema_name, table_name),
            )
            # Update workspace updated_at
            conn.execute(
                """
                UPDATE workspaces
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, workspace_id),
            )
            conn.commit()

    def remove_selection(
        self, workspace_id: str, connection_id: str, schema_name: str, table_name: str
    ) -> None:
        """Remove a table from workspace selections."""
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                DELETE FROM workspace_selections
                WHERE workspace_id = ?
                AND connection_id = ?
                AND schema_name = ?
                AND table_name = ?
                """,
                (workspace_id, connection_id, schema_name, table_name),
            )
            # Update workspace updated_at
            conn.execute(
                """
                UPDATE workspaces
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, workspace_id),
            )
            conn.commit()

    def get_workspace_selections(self, workspace_id: str) -> list[WorkspaceTableSelection]:
        """Get all table selections for a workspace."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT workspace_id, connection_id, schema_name, table_name
                FROM workspace_selections
                WHERE workspace_id = ?
                ORDER BY created_at
                """,
                (workspace_id,),
            )
            rows = cursor.fetchall()

            return [
                WorkspaceTableSelection(
                    workspace_id=row["workspace_id"],
                    connection_id=row["connection_id"],
                    schema_name=row["schema_name"],
                    table_name=row["table_name"],
                )
                for row in rows
            ]

    def clear_workspace_selections(self, workspace_id: str) -> None:
        """Remove all table selections from a workspace."""
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                DELETE FROM workspace_selections
                WHERE workspace_id = ?
                """,
                (workspace_id,),
            )
            # Update workspace updated_at
            conn.execute(
                """
                UPDATE workspaces
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, workspace_id),
            )
            conn.commit()


# Global workspace repository instance
workspace_repository = WorkspaceRepository()
