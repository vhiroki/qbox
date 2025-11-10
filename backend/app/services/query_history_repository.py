"""Repository for persisting query history."""

import sqlite3
from pathlib import Path
from typing import Any, Optional


class QueryHistoryRepository:
    """Repository for persisting query history."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Use same database as connections
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
                CREATE TABLE IF NOT EXISTS query_history (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    generated_sql TEXT NOT NULL,
                    executed_sql TEXT,
                    explanation TEXT,
                    row_count INTEGER,
                    execution_time_ms INTEGER,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
                        ON DELETE CASCADE
                )
            """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_query_history_workspace 
                ON query_history(workspace_id, created_at DESC)
            """
            )
            conn.commit()

    def save(
        self,
        query_id: str,
        workspace_id: str,
        prompt: str,
        generated_sql: str,
        executed_sql: str | None = None,
        explanation: str | None = None,
        row_count: int | None = None,
        execution_time_ms: int | None = None,
        error: str | None = None,
    ) -> None:
        """Save a query to history."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO query_history (
                    id, workspace_id, prompt, generated_sql, executed_sql,
                    explanation, row_count, execution_time_ms, error
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    query_id,
                    workspace_id,
                    prompt,
                    generated_sql,
                    executed_sql,
                    explanation,
                    row_count,
                    execution_time_ms,
                    error,
                ),
            )
            conn.commit()

    def get(self, query_id: str) -> Optional[dict[str, Any]]:
        """Get a specific query from history."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT * FROM query_history WHERE id = ?
                """,
                (query_id,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_workspace_history(
        self, workspace_id: str, limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        """Get query history for a workspace."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT * FROM query_history 
                WHERE workspace_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (workspace_id, limit, offset),
            )
            return [dict(row) for row in cursor.fetchall()]

    def delete(self, query_id: str) -> bool:
        """Delete a query from history."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM query_history WHERE id = ?",
                (query_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete_workspace_history(self, workspace_id: str) -> int:
        """Delete all queries for a workspace. Returns number of deleted queries."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM query_history WHERE workspace_id = ?",
                (workspace_id,),
            )
            conn.commit()
            return cursor.rowcount


# Global instance
_query_history_repo: Optional[QueryHistoryRepository] = None


def get_query_history_repository() -> QueryHistoryRepository:
    """Get or create the global query history repository instance."""
    global _query_history_repo
    if _query_history_repo is None:
        _query_history_repo = QueryHistoryRepository()
    return _query_history_repo
