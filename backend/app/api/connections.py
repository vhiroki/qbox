from app.models.schemas import ConnectionConfig, ConnectionStatus
from app.services.database import connection_manager
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/", response_model=ConnectionStatus)
async def create_connection(config: ConnectionConfig):
    """Create a new data source connection."""
    success, message, connection_id = await connection_manager.create_connection(config)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return ConnectionStatus(success=True, message=message, connection_id=connection_id)


@router.get("/")
async def list_connections():
    """List all active connections."""
    connections = await connection_manager.list_connections()
    return {"connections": connections}


@router.get("/saved")
async def list_saved_connections():
    """List all saved connection configurations."""
    saved = connection_manager.list_saved_connections()
    return {"connections": saved}


@router.post("/reconnect/{connection_id}")
async def reconnect_connection(connection_id: str):
    """Reconnect to a saved connection."""
    success, message = await connection_manager.reconnect(connection_id)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"success": True, "message": message, "connection_id": connection_id}


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str, delete_saved: bool = False):
    """
    Disconnect and remove a connection.

    Query params:
        delete_saved: If true, also deletes the saved configuration
    """
    success = await connection_manager.disconnect(connection_id, delete_saved)

    if not success:
        raise HTTPException(status_code=404, detail="Connection not found")

    return {"success": True, "message": "Connection closed"}


@router.get("/{connection_id}/schema")
async def get_schema(connection_id: str):
    """Get schema information for a connection."""
    datasource = await connection_manager.get_connection(connection_id)

    if not datasource:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        schema = await datasource.get_schema()
        return {"schema": schema}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
