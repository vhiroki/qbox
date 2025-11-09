"""API endpoints for metadata operations."""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import ConnectionMetadata
from app.services.connection_repository import connection_repository
from app.services.metadata import get_metadata_service

router = APIRouter(prefix="/metadata", tags=["metadata"])
logger = logging.getLogger(__name__)


@router.get("/{connection_id}", response_model=ConnectionMetadata)
async def get_connection_metadata(connection_id: str):
    """Get metadata for a specific connection.

    Args:
        connection_id: The connection identifier

    Returns:
        Complete metadata including schemas, tables, and columns
    """
    # Get connection config from repository
    connection_config = connection_repository.get(connection_id)
    if not connection_config:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        metadata_service = get_metadata_service()
        metadata = await metadata_service.refresh_metadata(
            connection_id=connection_id,
            connection_name=connection_config.name,
            source_type=connection_config.type,
            config=connection_config.config,
        )
        return metadata

    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get metadata for {connection_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve metadata: {str(e)}",
        )


@router.post("/{connection_id}/refresh", response_model=ConnectionMetadata)
async def refresh_connection_metadata(connection_id: str):
    """Manually refresh metadata for a connection.

    Args:
        connection_id: The connection identifier

    Returns:
        Updated metadata
    """
    # Reuse the get endpoint logic (they're the same for now)
    return await get_connection_metadata(connection_id)
