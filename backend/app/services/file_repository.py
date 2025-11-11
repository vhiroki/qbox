"""Repository for managing file uploads and metadata."""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.models.schemas import ColumnMetadata


class FileRepository:
    """Repository for file persistence and metadata."""

    def __init__(self, db_path: Optional[Path] = None, files_dir: Optional[Path] = None):
        if db_path is None:
            # Use same directory as connections database
            data_dir = Path.home() / ".qbox"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "connections.db"  # Use same database

        if files_dir is None:
            # Store files in ~/.qbox/files/
            files_dir = Path.home() / ".qbox" / "files"
            files_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = db_path
        self.files_dir = files_dir
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection with foreign keys enabled."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Initialize the database schema."""
        with self._get_connection() as conn:
            # Check if files table exists and has the view_name column
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='files'"
            )
            table_exists = cursor.fetchone() is not None
            
            if table_exists:
                # Check if view_name column exists
                cursor = conn.execute("PRAGMA table_info(files)")
                columns = [row[1] for row in cursor.fetchall()]
                
                if 'view_name' not in columns:
                    # Add view_name column to existing table
                    conn.execute("ALTER TABLE files ADD COLUMN view_name TEXT")
            else:
                # Create new table with view_name column
                conn.execute(
                    """
                    CREATE TABLE files (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        file_type TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        size_bytes INTEGER,
                        view_name TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """
                )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_files_name
                ON files(name)
            """
            )

            conn.commit()

    # File CRUD operations

    def create_file(
        self, name: str, original_filename: str, file_type: str, file_path: str, size_bytes: int
    ) -> dict[str, Any]:
        """Create a new file record."""
        file_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO files (id, name, original_filename, file_type, file_path, size_bytes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, name, original_filename, file_type, file_path, size_bytes, now, now),
            )
            conn.commit()

        return {
            "id": file_id,
            "name": name,
            "original_filename": original_filename,
            "file_type": file_type,
            "file_path": file_path,
            "size_bytes": size_bytes,
            "created_at": now,
            "updated_at": now,
        }

    def get_file(self, file_id: str) -> Optional[dict[str, Any]]:
        """Get a file by ID."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, created_at, updated_at
                FROM files
                WHERE id = ?
                """,
                (file_id,),
            )
            row = cursor.fetchone()

            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "original_filename": row["original_filename"],
                    "file_type": row["file_type"],
                    "file_path": row["file_path"],
                    "size_bytes": row["size_bytes"],
                    "view_name": row["view_name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            return None

    def get_all_files(self) -> list[dict[str, Any]]:
        """Get all files, ordered by most recently created."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, created_at, updated_at
                FROM files
                ORDER BY created_at DESC
                """
            )
            rows = cursor.fetchall()

            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "original_filename": row["original_filename"],
                    "file_type": row["file_type"],
                    "file_path": row["file_path"],
                    "size_bytes": row["size_bytes"],
                    "view_name": row["view_name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
                for row in rows
            ]

    def delete_file(self, file_id: str) -> bool:
        """Delete a file record and the physical file."""
        # Get file info first to delete physical file
        file_info = self.get_file(file_id)
        if not file_info:
            return False

        # Delete physical file
        file_path = Path(file_info["file_path"])
        if file_path.exists():
            file_path.unlink()

        # Delete database record
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_file_path(self, file_id: str) -> Optional[Path]:
        """Get the file system path for a file."""
        file_info = self.get_file(file_id)
        if file_info:
            return Path(file_info["file_path"])
        return None

    def get_file_by_name(self, name: str) -> Optional[dict[str, Any]]:
        """Get a file by name."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, created_at, updated_at
                FROM files
                WHERE name = ?
                """,
                (name,),
            )
            row = cursor.fetchone()

            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "original_filename": row["original_filename"],
                    "file_type": row["file_type"],
                    "file_path": row["file_path"],
                    "size_bytes": row["size_bytes"],
                    "view_name": row["view_name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            return None

    def update_view_name(self, file_id: str, view_name: str) -> bool:
        """Update the view name for a file."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE files SET view_name = ?, updated_at = ? WHERE id = ?",
                (view_name, datetime.now().isoformat(), file_id),
            )
            conn.commit()
            return cursor.rowcount > 0


# Global file repository instance
file_repository = FileRepository()

