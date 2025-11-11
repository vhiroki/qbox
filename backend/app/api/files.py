"""API endpoints for file management."""

import logging
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import FileInfo, FileMetadata, FileUploadResponse
from app.services.duckdb_manager import get_duckdb_manager
from app.services.file_repository import file_repository

router = APIRouter(prefix="/files", tags=["files"])
logger = logging.getLogger(__name__)

# Supported file types
SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """Upload a CSV or XLSX file."""
    try:
        # Validate file extension
        file_ext = Path(file.filename or "").suffix.lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}",
            )

        # Read file content and check size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)} MB",
            )

        # Generate unique name if file already exists
        base_name = Path(file.filename or "file").stem
        file_type = "csv" if file_ext == ".csv" else "xlsx"
        
        # Check if name already exists
        existing_file = file_repository.get_file_by_name(base_name)
        if existing_file:
            # Generate unique name
            counter = 1
            while file_repository.get_file_by_name(f"{base_name}_{counter}"):
                counter += 1
            base_name = f"{base_name}_{counter}"

        # Save file to disk
        file_id = None
        file_path = file_repository.files_dir / f"{base_name}{file_ext}"
        
        with open(file_path, "wb") as f:
            f.write(content)

        # Create database record
        file_record = file_repository.create_file(
            name=base_name,
            original_filename=file.filename or "unknown",
            file_type=file_type,
            file_path=str(file_path),
            size_bytes=len(content),
        )
        
        file_id = file_record["id"]

        # Register with DuckDB
        view_name = None
        try:
            duckdb = get_duckdb_manager()
            view_name = duckdb.register_file(file_id, base_name, str(file_path), file_type)
            
            # Store the view name in the database
            file_repository.update_view_name(file_id, view_name)
        except Exception as e:
            # If DuckDB registration fails, delete the file record and physical file
            logger.error(f"Failed to register file with DuckDB: {e}")
            file_repository.delete_file(file_id)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to register file: {str(e)}",
            )

        return FileUploadResponse(
            id=file_record["id"],
            name=file_record["name"],
            original_filename=file_record["original_filename"],
            file_type=file_record["file_type"],
            size_bytes=file_record["size_bytes"],
            created_at=file_record["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/", response_model=list[FileInfo])
async def list_files():
    """Get all uploaded files."""
    try:
        files = file_repository.get_all_files()
        return [
            FileInfo(
                id=f["id"],
                name=f["name"],
                original_filename=f["original_filename"],
                file_type=f["file_type"],
                size_bytes=f["size_bytes"],
                created_at=f["created_at"],
                updated_at=f["updated_at"],
            )
            for f in files
        ]
    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.get("/{file_id}", response_model=FileInfo)
async def get_file(file_id: str):
    """Get file information by ID."""
    file_info = file_repository.get_file(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    return FileInfo(
        id=file_info["id"],
        name=file_info["name"],
        original_filename=file_info["original_filename"],
        file_type=file_info["file_type"],
        size_bytes=file_info["size_bytes"],
        created_at=file_info["created_at"],
        updated_at=file_info["updated_at"],
    )


@router.get("/{file_id}/metadata", response_model=FileMetadata)
async def get_file_metadata(file_id: str):
    """Get file schema metadata."""
    file_info = file_repository.get_file(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        view_name = file_info.get("view_name")
        if not view_name:
            raise HTTPException(status_code=500, detail="File view name not found")
        
        duckdb = get_duckdb_manager()
        metadata = duckdb.get_file_metadata_by_view_name(view_name)
        
        return FileMetadata(
            file_id=file_id,
            file_name=file_info["name"],
            file_type=file_info["file_type"],
            view_name=view_name,
            columns=metadata["columns"],
            row_count=metadata.get("row_count"),
        )
    except Exception as e:
        logger.error(f"Failed to get file metadata: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get file metadata: {str(e)}"
        )


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Delete a file."""
    try:
        # Get file info first (needed for unregistering)
        file_info = file_repository.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Unregister from DuckDB first
        try:
            view_name = file_info.get("view_name")
            if view_name:
                duckdb = get_duckdb_manager()
                duckdb.unregister_file_by_view_name(view_name)
        except Exception as e:
            logger.warning(f"Failed to unregister file from DuckDB: {e}")

        # Delete from repository (includes physical file)
        success = file_repository.delete_file(file_id)
        if not success:
            raise HTTPException(status_code=404, detail="File not found")

        return {"success": True, "message": "File deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

