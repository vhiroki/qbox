"""Repository for persisting queries, their table selections, and chat history."""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.models.schemas import ChatMessage, Query, QueryTableSelection


class QueryRepository:
    """Repository for query, table selections, and chat history persistence."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            # Use same directory as connections database
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "connections.db"  # Use same database

        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection with foreign keys enabled."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Initialize the database schema."""
        with self._get_connection() as conn:
            # Queries table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS queries (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    sql_text TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Query selections table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS query_selections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id TEXT NOT NULL,
                    connection_id TEXT NOT NULL,
                    schema_name TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(query_id, connection_id, schema_name, table_name),
                    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
                )
            """
            )

            # Query chat history table (new)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS query_chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
                )
            """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_query_selections
                ON query_selections(query_id)
            """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_query_chat_history
                ON query_chat_history(query_id, created_at)
            """
            )

            # Query SQL history table (new)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS query_sql_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id TEXT NOT NULL,
                    sql_text TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
                )
            """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_query_sql_history
                ON query_sql_history(query_id, created_at DESC)
            """
            )

            # Migrate old tables if they exist
            self._migrate_from_workspaces(conn)

            conn.commit()

    def _migrate_from_workspaces(self, conn):
        """Migrate data from old tables to new query tables."""
        # Check if old tables exist
        cursor = conn.execute(
            """
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('workspaces', 'workspace_selections')
            """
        )
        old_tables = [row[0] for row in cursor.fetchall()]

        if "workspaces" in old_tables:
            # Migrate workspaces to queries
            conn.execute(
                """
                INSERT OR IGNORE INTO queries (id, name, sql_text, created_at, updated_at)
                SELECT id, name, '', created_at, updated_at FROM workspaces
                """
            )

        if "workspace_selections" in old_tables:
            # Migrate workspace_selections to query_selections
            conn.execute(
                """
                INSERT OR IGNORE INTO query_selections 
                    (query_id, connection_id, schema_name, table_name, created_at)
                SELECT workspace_id, connection_id, schema_name, table_name, created_at 
                FROM workspace_selections
                """
            )

    # Query CRUD operations

    def create_query(self, name: str, sql_text: str = "") -> Query:
        """Create a new query."""
        query_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO queries (id, name, sql_text, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (query_id, name, sql_text, now, now),
            )
            conn.commit()

        return Query(
            id=query_id,
            name=name,
            sql_text=sql_text,
            created_at=now,
            updated_at=now,
        )

    def get_query(self, query_id: str) -> Optional[Query]:
        """Get a query by ID."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, sql_text, created_at, updated_at
                FROM queries
                WHERE id = ?
                """,
                (query_id,),
            )
            row = cursor.fetchone()

            if row:
                return Query(
                    id=row["id"],
                    name=row["name"],
                    sql_text=row["sql_text"] or "",
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            return None

    def get_all_queries(self) -> list[Query]:
        """Get all queries, ordered by most recently updated."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, sql_text, created_at, updated_at
                FROM queries
                ORDER BY updated_at DESC
                """
            )
            rows = cursor.fetchall()

            return [
                Query(
                    id=row["id"],
                    name=row["name"],
                    sql_text=row["sql_text"] or "",
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in rows
            ]

    def update_query_sql(self, query_id: str, sql_text: str, save_to_history: bool = True) -> bool:
        """Update the SQL text of a query and optionally save to history."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            # Get current SQL to check if it's different
            cursor = conn.execute(
                "SELECT sql_text FROM queries WHERE id = ?",
                (query_id,)
            )
            row = cursor.fetchone()
            current_sql = row[0] if row else ""

            # Only save to history if SQL has actually changed
            if save_to_history and current_sql != sql_text:
                self._save_sql_to_history(conn, query_id, sql_text, now)

            # Update the query
            cursor = conn.execute(
                """
                UPDATE queries
                SET sql_text = ?, updated_at = ?
                WHERE id = ?
                """,
                (sql_text, now, query_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_query_name(self, query_id: str, name: str) -> bool:
        """Update the name of a query."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE queries
                SET name = ?, updated_at = ?
                WHERE id = ?
                """,
                (name, now, query_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def delete_query(self, query_id: str) -> bool:
        """Delete a query and all its selections and chat history (CASCADE)."""
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM queries WHERE id = ?", (query_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Table selection operations

    def add_table_selection(
        self, query_id: str, connection_id: str, schema_name: str, table_name: str
    ) -> None:
        """Add a table to query selections."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO query_selections
                    (query_id, connection_id, schema_name, table_name, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (query_id, connection_id, schema_name, table_name, now),
            )
            # Update query updated_at
            conn.execute(
                """
                UPDATE queries
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, query_id),
            )
            conn.commit()

    def remove_table_selection(
        self, query_id: str, connection_id: str, schema_name: str, table_name: str
    ) -> bool:
        """Remove a table from query selections."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                DELETE FROM query_selections
                WHERE query_id = ? AND connection_id = ? 
                    AND schema_name = ? AND table_name = ?
                """,
                (query_id, connection_id, schema_name, table_name),
            )
            # Update query updated_at
            conn.execute(
                """
                UPDATE queries
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, query_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_query_selections(self, query_id: str) -> list[QueryTableSelection]:
        """Get all table selections for a query."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT query_id, connection_id, schema_name, table_name
                FROM query_selections
                WHERE query_id = ?
                ORDER BY created_at
                """,
                (query_id,),
            )
            rows = cursor.fetchall()

            return [
                QueryTableSelection(
                    query_id=row["query_id"],
                    connection_id=row["connection_id"],
                    schema_name=row["schema_name"],
                    table_name=row["table_name"],
                )
                for row in rows
            ]

    def clear_query_selections(self, query_id: str) -> None:
        """Remove all table selections from a query."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            conn.execute(
                """
                DELETE FROM query_selections
                WHERE query_id = ?
                """,
                (query_id,),
            )
            # Update query updated_at
            conn.execute(
                """
                UPDATE queries
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, query_id),
            )
            conn.commit()

    def delete_selections_by_connection(self, connection_id: str) -> int:
        """Remove all table selections for a specific connection.
        
        Returns the number of selections deleted.
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                DELETE FROM query_selections
                WHERE connection_id = ?
                """,
                (connection_id,),
            )
            conn.commit()
            return cursor.rowcount

    # Chat history operations

    def add_chat_message(self, query_id: str, role: str, message: str) -> ChatMessage:
        """Add a message to query chat history."""
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO query_chat_history (query_id, role, message, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (query_id, role, message, now),
            )
            message_id = cursor.lastrowid

            # Update query updated_at
            conn.execute(
                """
                UPDATE queries
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, query_id),
            )
            conn.commit()

        return ChatMessage(
            id=message_id, query_id=query_id, role=role, message=message, created_at=now
        )

    def get_chat_history(self, query_id: str) -> list[ChatMessage]:
        """Get all chat messages for a query."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, query_id, role, message, created_at
                FROM query_chat_history
                WHERE query_id = ?
                ORDER BY created_at ASC
                """,
                (query_id,),
            )
            rows = cursor.fetchall()

            return [
                ChatMessage(
                    id=row["id"],
                    query_id=row["query_id"],
                    role=row["role"],
                    message=row["message"],
                    created_at=row["created_at"],
                )
                for row in rows
            ]

    def clear_chat_history(self, query_id: str) -> None:
        """Clear all chat messages for a query."""
        with self._get_connection() as conn:
            conn.execute(
                """
                DELETE FROM query_chat_history
                WHERE query_id = ?
                """,
                (query_id,),
            )
            conn.commit()

    # SQL history operations

    def _save_sql_to_history(
        self, conn: sqlite3.Connection, query_id: str, sql_text: str, timestamp: str
    ) -> None:
        """Save SQL to history and maintain maximum of 50 versions."""
        # Add new version
        conn.execute(
            """
            INSERT INTO query_sql_history (query_id, sql_text, created_at)
            VALUES (?, ?, ?)
            """,
            (query_id, sql_text, timestamp),
        )

        # Count total versions for this query
        cursor = conn.execute(
            """
            SELECT COUNT(*) FROM query_sql_history WHERE query_id = ?
            """,
            (query_id,),
        )
        count = cursor.fetchone()[0]

        # If we exceed 50 versions, delete the oldest ones
        if count > 50:
            conn.execute(
                """
                DELETE FROM query_sql_history
                WHERE id IN (
                    SELECT id FROM query_sql_history
                    WHERE query_id = ?
                    ORDER BY created_at ASC
                    LIMIT ?
                )
                """,
                (query_id, count - 50),
            )

    def get_sql_history(self, query_id: str) -> list[dict[str, Any]]:
        """Get SQL history for a query, ordered by most recent first."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, query_id, sql_text, created_at
                FROM query_sql_history
                WHERE query_id = ?
                ORDER BY created_at DESC
                """,
                (query_id,),
            )
            rows = cursor.fetchall()

            return [
                {
                    "id": row["id"],
                    "query_id": row["query_id"],
                    "sql_text": row["sql_text"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]

    def restore_sql_from_history(self, query_id: str, history_id: int) -> Optional[str]:
        """Restore SQL from a history entry. Returns the restored SQL text."""
        with self._get_connection() as conn:
            # Get the SQL from history
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT sql_text FROM query_sql_history
                WHERE id = ? AND query_id = ?
                """,
                (history_id, query_id),
            )
            row = cursor.fetchone()

            if not row:
                return None

            sql_text = row["sql_text"]

            # Update the query with this SQL (without saving to history to avoid duplication)
            now = datetime.now().isoformat()
            conn.execute(
                """
                UPDATE queries
                SET sql_text = ?, updated_at = ?
                WHERE id = ?
                """,
                (sql_text, now, query_id),
            )
            conn.commit()

            return sql_text


# Global query repository instance
query_repository = QueryRepository()
