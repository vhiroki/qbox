"""Settings API endpoints."""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.models.schemas import AISettings, AISettingsUpdate
from app.services import duckdb_manager
from app.services.connection_repository import connection_repository
from app.services.duckdb_manager import get_duckdb_manager
from app.services.query_repository import query_repository
from app.services.settings_repository import settings_repository
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/settings/ai")
async def get_ai_settings() -> AISettings:
    """
    Get current AI configuration settings.
    
    Returns the configured AI model, temperature, and API keys.
    API keys are returned masked for security.
    """
    try:
        # Get settings from database
        db_settings = settings_repository.get_ai_settings()
        
        # Get environment fallbacks from config
        config_settings = get_settings()
        
        # Use database settings if available, otherwise fall back to config/env
        openai_key = db_settings.get("openai_api_key") or config_settings.OPENAI_API_KEY
        anthropic_key = db_settings.get("anthropic_api_key") or config_settings.ANTHROPIC_API_KEY
        gemini_key = db_settings.get("gemini_api_key") or config_settings.GEMINI_API_KEY
        model = db_settings.get("ai_model") or config_settings.AI_MODEL
        temperature_str = db_settings.get("ai_temperature")
        temperature = float(temperature_str) if temperature_str else config_settings.AI_TEMPERATURE
        
        # Mask API keys for security (show last 4 chars only if set)
        def mask_key(key: str | None) -> str | None:
            if not key:
                return None
            if len(key) <= 4:
                return "****"
            return "*" * (len(key) - 4) + key[-4:]
        
        return AISettings(
            openai_api_key=mask_key(openai_key),
            anthropic_api_key=mask_key(anthropic_key),
            gemini_api_key=mask_key(gemini_key),
            ai_model=model,
            ai_temperature=temperature,
        )
    except Exception as e:
        logger.error(f"Failed to get AI settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get AI settings: {str(e)}"
        )


@router.put("/settings/ai")
async def update_ai_settings(settings: AISettingsUpdate) -> AISettings:
    """
    Update AI configuration settings.
    
    Updates the AI model, temperature, and/or API keys.
    Only provided fields will be updated.
    """
    try:
        # Update settings in database
        settings_repository.set_ai_settings(
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key,
            gemini_api_key=settings.gemini_api_key,
            ai_model=settings.ai_model,
            ai_temperature=settings.ai_temperature,
        )
        
        logger.info("AI settings updated successfully")
        
        # Return updated settings (masked)
        return await get_ai_settings()
    except Exception as e:
        logger.error(f"Failed to update AI settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update AI settings: {str(e)}"
        )


@router.post("/settings/clear-all-data")
async def clear_all_data():
    """
    Clear all data from QBox.
    
    This will:
    - Delete all queries, selections, and chat history
    - Delete all saved connections
    - Close and delete the DuckDB database file
    - Reset the app to a clean state
    """
    try:
        # Get the data directory
        data_dir = Path.home() / ".qbox"
        
        # Close DuckDB connection if open
        db_manager = get_duckdb_manager()
        if db_manager.conn:
            db_manager.close()
        
        # Reset the global DuckDB manager instance
        duckdb_manager._duckdb_manager = None
        
        # Delete DuckDB file
        duckdb_path = data_dir / "qbox.duckdb"
        if duckdb_path.exists():
            try:
                os.remove(duckdb_path)
                logger.info("Deleted DuckDB file")
            except Exception as e:
                logger.error(f"Failed to delete DuckDB file: {e}")
                raise HTTPException(
                    status_code=500, detail=f"Failed to delete DuckDB file: {str(e)}"
                )
        
        # Delete all data from SQLite (connections.db)
        db_path = data_dir / "connections.db"
        if db_path.exists():
            try:
                os.remove(db_path)
                logger.info("Deleted SQLite database")
                
                # Reinitialize the repositories (they will create fresh tables)
                connection_repository._init_db()
                query_repository._init_db()
                logger.info("Reinitialized database schema")
            except Exception as e:
                logger.error(f"Failed to clear SQLite database: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to clear SQLite database: {str(e)}",
                )
        
        return {
            "success": True,
            "message": "All data has been cleared successfully",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error clearing data: {e}")
        raise HTTPException(
            status_code=500, detail=f"Unexpected error: {str(e)}"
        )

