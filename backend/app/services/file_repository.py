"""Repository for managing file uploads and metadata."""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional


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
        # Note: Schema initialization is now handled by migrations

    def get_query_files_dir(self, query_id: str) -> Path:
        """Get the directory for storing files for a specific query.

        Creates the directory if it doesn't exist.
        """
        query_dir = self.files_dir / query_id
        query_dir.mkdir(parents=True, exist_ok=True)
        return query_dir

    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection with foreign keys enabled."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    # File CRUD operations

    def create_file(
        self,
        name: str,
        original_filename: str,
        file_type: str,
        file_path: str,
        size_bytes: int,
        query_id: str,
    ) -> dict[str, Any]:
        """Create a new file record scoped to a query."""
        file_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO files (id, name, original_filename, file_type, file_path, size_bytes, query_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    name,
                    original_filename,
                    file_type,
                    file_path,
                    size_bytes,
                    query_id,
                    now,
                    now,
                ),
            )
            conn.commit()

        return {
            "id": file_id,
            "name": name,
            "original_filename": original_filename,
            "file_type": file_type,
            "file_path": file_path,
            "size_bytes": size_bytes,
            "query_id": query_id,
            "created_at": now,
            "updated_at": now,
        }

    def get_file(self, file_id: str) -> Optional[dict[str, Any]]:
        """Get a file by ID."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, query_id, created_at, updated_at
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
                    "query_id": row["query_id"],
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
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, query_id, created_at, updated_at
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
                    "query_id": row["query_id"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
                for row in rows
            ]

    def get_files_by_query(self, query_id: str) -> list[dict[str, Any]]:
        """Get all files for a specific query, ordered by most recently created."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, query_id, created_at, updated_at
                FROM files
                WHERE query_id = ?
                ORDER BY created_at DESC
                """,
                (query_id,),
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
                    "query_id": row["query_id"],
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

    def get_file_by_name(
        self, name: str, query_id: Optional[str] = None
    ) -> Optional[dict[str, Any]]:
        """Get a file by name, optionally scoped to a query."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row

            if query_id:
                cursor = conn.execute(
                    """
                    SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, query_id, created_at, updated_at
                    FROM files
                    WHERE name = ? AND query_id = ?
                    """,
                    (name, query_id),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT id, name, original_filename, file_type, file_path, size_bytes, view_name, query_id, created_at, updated_at
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
                    "query_id": row["query_id"],
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

    def duplicate_file(
        self, source_file: dict[str, Any], new_query_id: str
    ) -> Optional[dict[str, Any]]:
        """Duplicate a file record and its physical file for a new query.

        Args:
            source_file: The source file record dict
            new_query_id: The query ID to associate the new file with

        Returns:
            The new file record dict, or None if duplication failed
        """
        import shutil

        source_path = Path(source_file["file_path"])
        if not source_path.exists():
            return None

        # Use the same base name - each query has its own folder so no conflicts
        base_name = source_file["name"]
        file_ext = source_path.suffix

        # Get the query-specific directory for the new query
        query_dir = self.get_query_files_dir(new_query_id)
        new_file_path = query_dir / f"{base_name}{file_ext}"

        # Copy physical file
        try:
            shutil.copy2(source_path, new_file_path)
        except Exception as e:
            import logging

            logging.getLogger(__name__).error(f"Failed to copy file: {e}")
            return None

        # Create new database record
        new_file = self.create_file(
            name=base_name,
            original_filename=source_file["original_filename"],
            file_type=source_file["file_type"],
            file_path=str(new_file_path),
            size_bytes=source_file["size_bytes"],
            query_id=new_query_id,
        )

        return new_file


# Global file repository instance
file_repository = FileRepository()
