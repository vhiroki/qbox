"""Database migration service using Yoyo migrations."""

import logging
import sqlite3
from pathlib import Path
from typing import Optional

from yoyo import get_backend, read_migrations
from yoyo.backends import DatabaseBackend
from yoyo.migrations import MigrationList

logger = logging.getLogger(__name__)

# Default data directory
DEFAULT_DATA_DIR = Path.home() / ".qbox"
DEFAULT_DB_PATH = DEFAULT_DATA_DIR / "connections.db"


class MigrationService:
    """Service for managing database migrations."""

    def __init__(self, db_path: Optional[Path] = None):
        """Initialize the migration service.

        Args:
            db_path: Path to the SQLite database. Defaults to ~/.qbox/connections.db
        """
        if db_path is None:
            db_path = DEFAULT_DB_PATH

        self.db_path = db_path
        self.migrations_dir = Path(__file__).parent.parent / "migrations"

        # Ensure data directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def _get_backend(self) -> DatabaseBackend:
        """Get a Yoyo backend for the SQLite database."""
        # Use SQLite URI format for yoyo
        db_uri = f"sqlite:///{self.db_path}"
        return get_backend(db_uri)

    def _get_migrations(self) -> MigrationList:
        """Read all available migrations."""
        return read_migrations(str(self.migrations_dir))

    def _check_existing_tables(self) -> bool:
        """Check if database has existing tables (pre-migration setup).

        Returns:
            True if tables exist, False if database is empty
        """
        if not self.db_path.exists():
            return False

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_yoyo%'"
            )
            tables = [row[0] for row in cursor.fetchall()]

            # Check for any of the expected QBox tables
            expected_tables = {
                "connections", "queries", "query_selections",
                "query_chat_history", "query_sql_history", "files", "settings"
            }
            return bool(expected_tables.intersection(tables))

    def _mark_initial_migration_applied(self, backend: DatabaseBackend) -> None:
        """Mark the initial migration as applied without running it.

        This is used for existing databases that already have the schema.
        We directly insert into yoyo's tracking table to mark it as applied.
        """
        migrations = self._get_migrations()

        # Find the initial migration
        initial_migration = None
        for m in migrations:
            if "0001-initial-schema" in m.id:
                initial_migration = m
                break

        if initial_migration:
            # Check if this migration is not already applied
            applied_migrations = backend.to_rollback(migrations)
            if initial_migration not in applied_migrations:
                logger.info("Marking initial migration as applied (existing database)")
                # Directly insert into yoyo's migration tracking table
                # This is the same as what yoyo does internally when applying a migration
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO _yoyo_migration (migration_hash, migration_id, applied_at_utc)
                        VALUES (?, ?, datetime('now'))
                        """,
                        (initial_migration.hash, initial_migration.id)
                    )
                    conn.commit()

    def run_migrations(self) -> int:
        """Run all pending migrations.

        Handles the special case of existing databases by marking the initial
        migration as applied if tables already exist.

        Returns:
            Number of migrations applied
        """
        backend = self._get_backend()
        migrations = self._get_migrations()

        with backend.lock():
            # Handle pre-existing databases
            if self._check_existing_tables():
                applied_migrations = backend.to_rollback(migrations)
                if not applied_migrations:
                    # Database has tables but no migration history
                    # This is a pre-migration database - mark initial as applied
                    logger.info("Detected existing database without migration history")
                    self._mark_initial_migration_applied(backend)

            # Apply any pending migrations
            to_apply = backend.to_apply(migrations)

            if not to_apply:
                logger.info("Database is up to date, no migrations to apply")
                return 0

            logger.info(f"Applying {len(to_apply)} migration(s)...")

            for migration in to_apply:
                logger.info(f"Applying migration: {migration.id}")

            backend.apply_migrations(to_apply)

            logger.info(f"Successfully applied {len(to_apply)} migration(s)")
            return len(to_apply)

    def rollback(self, count: int = 1) -> int:
        """Rollback the specified number of migrations.

        Args:
            count: Number of migrations to rollback (default: 1)

        Returns:
            Number of migrations rolled back
        """
        backend = self._get_backend()
        migrations = self._get_migrations()

        with backend.lock():
            to_rollback = backend.to_rollback(migrations)[:count]

            if not to_rollback:
                logger.info("No migrations to rollback")
                return 0

            logger.info(f"Rolling back {len(to_rollback)} migration(s)...")

            for migration in to_rollback:
                logger.info(f"Rolling back migration: {migration.id}")

            backend.rollback_migrations(to_rollback)

            logger.info(f"Successfully rolled back {len(to_rollback)} migration(s)")
            return len(to_rollback)

    def get_status(self) -> dict:
        """Get current migration status.

        Returns:
            Dictionary with applied and pending migration info
        """
        backend = self._get_backend()
        migrations = self._get_migrations()

        applied = backend.to_rollback(migrations)
        to_apply = backend.to_apply(migrations)

        return {
            "applied": [m.id for m in applied],
            "pending": [m.id for m in to_apply],
            "is_up_to_date": len(to_apply) == 0,
        }


# Global migration service instance
_migration_service: Optional[MigrationService] = None


def get_migration_service(db_path: Optional[Path] = None) -> MigrationService:
    """Get the global migration service instance."""
    global _migration_service
    if _migration_service is None:
        _migration_service = MigrationService(db_path)
    return _migration_service


def run_migrations(db_path: Optional[Path] = None) -> int:
    """Convenience function to run all pending migrations.

    Args:
        db_path: Optional path to database

    Returns:
        Number of migrations applied
    """
    service = MigrationService(db_path)
    return service.run_migrations()
