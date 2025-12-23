"""Repository for managing application settings in the database."""

import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class SettingsRepository:
    """Repository for application settings."""

    def __init__(self, db_path: Path | None = None):
        """Initialize the settings repository."""
        if db_path is None:
            db_path = Path.home() / ".qbox" / "connections.db"

        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # Note: Schema initialization is now handled by migrations

    def get(self, key: str) -> Optional[str]:
        """Get a setting value by key."""
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row[0] if row else None

    def set(self, key: str, value: str) -> None:
        """Set a setting value."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute(
                """
                INSERT INTO settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
            conn.commit()
            logger.debug(f"Setting '{key}' updated")

    def delete(self, key: str) -> None:
        """Delete a setting."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (key,))
            conn.commit()
            logger.debug(f"Setting '{key}' deleted")

    def get_all(self) -> dict[str, str]:
        """Get all settings as a dictionary."""
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("SELECT key, value FROM settings")
            return dict(cursor.fetchall())

    def get_ai_settings(self) -> dict[str, Optional[str]]:
        """Get AI-specific settings."""
        return {
            "openai_api_key": self.get("openai_api_key"),
            "anthropic_api_key": self.get("anthropic_api_key"),
            "gemini_api_key": self.get("gemini_api_key"),
            "ai_model": self.get("ai_model"),
            "ai_temperature": self.get("ai_temperature"),
        }

    def set_ai_settings(
        self,
        openai_api_key: Optional[str] = None,
        anthropic_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        ai_model: Optional[str] = None,
        ai_temperature: Optional[float] = None,
    ) -> None:
        """Set AI-specific settings (only updates provided values)."""
        if openai_api_key is not None:
            if openai_api_key:
                self.set("openai_api_key", openai_api_key)
            else:
                self.delete("openai_api_key")

        if anthropic_api_key is not None:
            if anthropic_api_key:
                self.set("anthropic_api_key", anthropic_api_key)
            else:
                self.delete("anthropic_api_key")

        if gemini_api_key is not None:
            if gemini_api_key:
                self.set("gemini_api_key", gemini_api_key)
            else:
                self.delete("gemini_api_key")

        if ai_model is not None:
            self.set("ai_model", ai_model)

        if ai_temperature is not None:
            self.set("ai_temperature", str(ai_temperature))

        logger.info("AI settings updated")


# Global settings repository instance
settings_repository = SettingsRepository()
