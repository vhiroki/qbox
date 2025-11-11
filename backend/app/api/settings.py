"""Settings API endpoints."""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.services import duckdb_manager
from app.services.connection_repository import connection_repository
from app.services.duckdb_manager import get_duckdb_manager
from app.services.query_repository import query_repository

logger = logging.getLogger(__name__)

router = APIRouter()


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

