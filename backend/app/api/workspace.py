"""API endpoints for workspace operations."""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Workspace,
    WorkspaceCreate,
    WorkspaceSelections,
    WorkspaceTableSelectionRequest,
)
from app.services.workspace_repository import workspace_repository

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
logger = logging.getLogger(__name__)


# Workspace CRUD endpoints


@router.get("/", response_model=list[Workspace])
async def list_workspaces():
    """Get all workspaces."""
    return workspace_repository.get_all_workspaces()


@router.post("/", response_model=Workspace)
async def create_workspace(workspace: WorkspaceCreate):
    """Create a new workspace."""
    try:
        return workspace_repository.create_workspace(workspace.name)
    except Exception as e:
        logger.error(f"Failed to create workspace: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create workspace: {str(e)}")


@router.get("/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str):
    """Get a workspace by ID."""
    workspace = workspace_repository.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str):
    """Delete a workspace and all its selections."""
    try:
        deleted = workspace_repository.delete_workspace(workspace_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Workspace not found")
        return {"success": True, "message": "Workspace deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete workspace: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete workspace: {str(e)}")


# Table selection endpoints


@router.get("/{workspace_id}/selections", response_model=WorkspaceSelections)
async def get_workspace_selections(workspace_id: str):
    """Get all tables selected in a workspace."""
    selections = workspace_repository.get_workspace_selections(workspace_id)
    return WorkspaceSelections(workspace_id=workspace_id, selections=selections)


@router.post("/{workspace_id}/selections")
async def add_workspace_selection(workspace_id: str, selection: WorkspaceTableSelectionRequest):
    """Add a table to the workspace."""
    try:
        workspace_repository.add_selection(
            workspace_id=workspace_id,
            connection_id=selection.connection_id,
            schema_name=selection.schema_name,
            table_name=selection.table_name,
        )
        return {"success": True, "message": "Table added to workspace"}
    except Exception as e:
        logger.error(f"Failed to add selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add selection: {str(e)}")


@router.delete("/{workspace_id}/selections")
async def remove_workspace_selection(workspace_id: str, selection: WorkspaceTableSelectionRequest):
    """Remove a table from the workspace."""
    try:
        workspace_repository.remove_selection(
            workspace_id=workspace_id,
            connection_id=selection.connection_id,
            schema_name=selection.schema_name,
            table_name=selection.table_name,
        )
        return {"success": True, "message": "Table removed from workspace"}
    except Exception as e:
        logger.error(f"Failed to remove selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove selection: {str(e)}")
