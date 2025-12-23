"""API endpoints for S3 operations."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.s3_service import get_s3_service

router = APIRouter(prefix="/s3", tags=["s3"])


@router.get("/{connection_id}/list")
async def list_s3_files(
    connection_id: str,
    prefix: str = Query(default="", description="Path prefix to list"),
    max_results: int = Query(default=100, ge=1, le=1000, description="Maximum results per page"),
    continuation_token: Optional[str] = Query(default=None, description="Pagination token"),
    flat: bool = Query(
        default=False,
        description="If true, list all files with prefix (no delimiter). If false, hierarchical view.",
    ),
):
    """
    List files and folders in an S3 bucket at a given prefix.

    Returns a hierarchical view with folders and files, supporting pagination.
    Set flat=true for prefix filtering to get all files regardless of depth.
    """
    try:
        s3_service = get_s3_service()
        result = await s3_service.list_files(
            connection_id=connection_id,
            prefix=prefix,
            max_results=max_results,
            continuation_token=continuation_token,
            flat=flat,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list S3 files: {str(e)}")


@router.get("/{connection_id}/metadata")
async def get_s3_file_metadata(
    connection_id: str,
    file_path: str = Query(..., description="Full path to the file in the bucket"),
):
    """
    Get metadata (columns and types) for a structured data file in S3.

    Supports parquet, CSV, JSON, and JSONL files.
    """
    try:
        s3_service = get_s3_service()
        metadata = await s3_service.get_file_metadata(
            connection_id=connection_id, file_path=file_path
        )
        return metadata
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file metadata: {str(e)}")


@router.post("/{connection_id}/view")
async def create_s3_file_view(
    connection_id: str,
    file_path: str = Query(..., description="Full path to the file in the bucket"),
    view_name: Optional[str] = Query(default=None, description="Optional custom view name"),
):
    """
    Create a DuckDB view for an S3 file.

    This allows the file to be queried using SQL like a regular table.
    """
    try:
        s3_service = get_s3_service()
        created_view_name = await s3_service.create_file_view(
            connection_id=connection_id, file_path=file_path, view_name=view_name
        )
        return {
            "success": True,
            "view_name": created_view_name,
            "message": f"View '{created_view_name}' created successfully",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create view: {str(e)}")
