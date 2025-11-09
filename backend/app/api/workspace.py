"""API endpoints for workspace operations."""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import WorkspaceMetadataExport, WorkspaceSelections, WorkspaceTableSelection
from app.services.connection_repository import connection_repository
from app.services.metadata import get_metadata_service
from app.services.workspace_repository import workspace_repository

router = APIRouter(prefix="/workspace", tags=["workspace"])
logger = logging.getLogger(__name__)


@router.get("/selections", response_model=WorkspaceSelections)
async def get_workspace_selections():
    """Get all tables selected in the workspace."""
    selections = workspace_repository.get_all_selections()
    return WorkspaceSelections(selections=selections)


@router.post("/selections")
async def add_workspace_selection(selection: WorkspaceTableSelection):
    """Add a table to the workspace."""
    try:
        workspace_repository.add_selection(
            connection_id=selection.connection_id,
            schema_name=selection.schema_name,
            table_name=selection.table_name,
        )
        return {"success": True, "message": "Table added to workspace"}
    except Exception as e:
        logger.error(f"Failed to add selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add selection: {str(e)}")


@router.delete("/selections")
async def remove_workspace_selection(selection: WorkspaceTableSelection):
    """Remove a table from the workspace."""
    try:
        workspace_repository.remove_selection(
            connection_id=selection.connection_id,
            schema_name=selection.schema_name,
            table_name=selection.table_name,
        )
        return {"success": True, "message": "Table removed from workspace"}
    except Exception as e:
        logger.error(f"Failed to remove selection: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove selection: {str(e)}",
        )


@router.delete("/selections/all")
async def clear_workspace():
    """Clear all workspace selections."""
    try:
        workspace_repository.clear_all()
        return {"success": True, "message": "Workspace cleared"}
    except Exception as e:
        logger.error(f"Failed to clear workspace: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear workspace: {str(e)}")


@router.get("/export", response_model=WorkspaceMetadataExport)
async def export_workspace_metadata():
    """Export workspace metadata as markdown."""
    try:
        selections = workspace_repository.get_all_selections()

        if not selections:
            return WorkspaceMetadataExport(
                markdown="# Workspace Metadata\n\nNo tables selected.",
                filename="workspace_metadata.md",
            )

        # Get metadata for all connections
        metadata_service = get_metadata_service()
        markdown_parts = ["# Workspace Metadata\n"]
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        markdown_parts.append(f"*Generated on {timestamp} UTC*\n")

        # Group selections by connection
        conn_groups: dict[str, list[WorkspaceTableSelection]] = {}
        for sel in selections:
            if sel.connection_id not in conn_groups:
                conn_groups[sel.connection_id] = []
            conn_groups[sel.connection_id].append(sel)

        # Generate markdown for each connection
        for connection_id, sel_list in conn_groups.items():
            # Get connection config
            conn_config = connection_repository.get(connection_id)
            if not conn_config:
                continue

            # Get full metadata
            conn_metadata = await metadata_service.refresh_metadata(
                connection_id=connection_id,
                connection_name=conn_config.name,
                source_type=conn_config.type,
                config=conn_config.config,
            )

            markdown_parts.append(f"\n## {conn_config.name}\n")
            markdown_parts.append(f"**Type:** {conn_config.type.value}\n\n")

            # Find selected tables in metadata
            for sel in sel_list:
                for schema in conn_metadata.schemas:
                    if schema.name != sel.schema_name:
                        continue

                    for table in schema.tables:
                        if table.name != sel.table_name:
                            continue

                        # Add table info
                        markdown_parts.append(f"### {schema.name}.{table.name}\n")
                        if table.row_count is not None:
                            markdown_parts.append(f"**Rows:** {table.row_count:,}\n\n")

                        # Add columns
                        markdown_parts.append("| Column | Type | " "Nullable | Primary Key |\n")
                        markdown_parts.append("|--------|------|----------|-------------|\n")

                        for col in table.columns:
                            pk_marker = "✓" if col.is_primary_key else ""
                            nullable = "Yes" if col.nullable else "No"
                            markdown_parts.append(
                                f"| {col.name} | {col.type} | " f"{nullable} | {pk_marker} |\n"
                            )

                        markdown_parts.append("\n")

        markdown_content = "".join(markdown_parts)
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"workspace_metadata_{timestamp_str}.md"

        return WorkspaceMetadataExport(markdown=markdown_content, filename=filename)

    except Exception as e:
        logger.error(f"Failed to export metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export metadata: {str(e)}")
