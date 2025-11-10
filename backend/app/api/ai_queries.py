"""API endpoints for AI-powered query generation and execution."""

import time
import uuid

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    AIQueryRequest,
    AIQueryResponse,
    QueryExecutionRequest,
    QueryExecutionResult,
    QueryHistoryItem,
    QueryHistoryList,
)
from app.services.ai_service import get_ai_service
from app.services.duckdb_manager import get_duckdb_manager
from app.services.metadata import get_workspace_metadata
from app.services.query_history_repository import get_query_history_repository
from app.services.workspace_repository import workspace_repository

router = APIRouter()


@router.post("/workspaces/{workspace_id}/ai-query", response_model=AIQueryResponse)
async def generate_sql_query(workspace_id: str, request: AIQueryRequest):
    """Generate SQL query from natural language using AI."""
    # Verify workspace exists
    workspace = workspace_repository.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get workspace metadata for context
    try:
        workspace_metadata = await get_workspace_metadata(workspace_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workspace metadata: {str(e)}",
        )

    if not workspace_metadata:
        raise HTTPException(
            status_code=400,
            detail="No tables in workspace. Add tables before querying.",
        )

    # Generate SQL using AI service
    try:
        ai_service = get_ai_service()
        result = await ai_service.generate_sql_from_prompt(
            prompt=request.prompt,
            workspace_metadata=workspace_metadata,
            additional_instructions=request.additional_instructions,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SQL: {str(e)}",
        )

    # Create query ID and save to history
    query_id = str(uuid.uuid4())
    query_history_repo = get_query_history_repository()

    query_history_repo.save(
        query_id=query_id,
        workspace_id=workspace_id,
        prompt=request.prompt,
        generated_sql=result["sql"],
        explanation=result.get("explanation"),
    )

    return AIQueryResponse(
        query_id=query_id,
        generated_sql=result["sql"],
        explanation=result.get("explanation"),
    )


@router.post(
    "/workspaces/{workspace_id}/execute-query",
    response_model=QueryExecutionResult,
)
async def execute_query(workspace_id: str, request: QueryExecutionRequest):
    """Execute a SQL query in the workspace context."""
    # Verify workspace exists
    workspace = workspace_repository.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Execute query using DuckDB manager
    duckdb_manager = get_duckdb_manager()

    try:
        start_time = time.time()
        columns, rows = duckdb_manager.execute_query(request.sql)
        execution_time_ms = int((time.time() - start_time) * 1000)

        result = QueryExecutionResult(
            success=True,
            columns=columns,
            rows=rows,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
        )

        # Update query history if this was an AI-generated query
        if request.save_to_history and request.query_id:
            query_history_repo = get_query_history_repository()
            existing = query_history_repo.get(request.query_id)

            if existing:
                # Update with execution results
                query_history_repo.save(
                    query_id=request.query_id,
                    workspace_id=workspace_id,
                    prompt=existing["prompt"],
                    generated_sql=existing["generated_sql"],
                    executed_sql=request.sql,
                    explanation=existing.get("explanation"),
                    row_count=len(rows),
                    execution_time_ms=execution_time_ms,
                )

        return result

    except Exception as e:
        error_msg = str(e)

        # Update query history with error if applicable
        if request.save_to_history and request.query_id:
            query_history_repo = get_query_history_repository()
            existing = query_history_repo.get(request.query_id)

            if existing:
                query_history_repo.save(
                    query_id=request.query_id,
                    workspace_id=workspace_id,
                    prompt=existing["prompt"],
                    generated_sql=existing["generated_sql"],
                    executed_sql=request.sql,
                    explanation=existing.get("explanation"),
                    error=error_msg,
                )

        return QueryExecutionResult(success=False, error=error_msg)


@router.get(
    "/workspaces/{workspace_id}/query-history",
    response_model=QueryHistoryList,
)
async def get_query_history(workspace_id: str, limit: int = 50, offset: int = 0):
    """Get query history for a workspace."""
    # Verify workspace exists
    workspace = workspace_repository.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    query_history_repo = get_query_history_repository()
    history = query_history_repo.get_workspace_history(workspace_id, limit=limit, offset=offset)

    queries = [QueryHistoryItem(**item) for item in history]

    return QueryHistoryList(workspace_id=workspace_id, queries=queries, total=len(queries))


@router.delete("/workspaces/{workspace_id}/query-history/{query_id}")
async def delete_query_from_history(workspace_id: str, query_id: str):
    """Delete a specific query from history."""
    query_history_repo = get_query_history_repository()

    # Verify query exists and belongs to workspace
    query = query_history_repo.get(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    if query["workspace_id"] != workspace_id:
        raise HTTPException(status_code=403, detail="Query does not belong to this workspace")

    deleted = query_history_repo.delete(query_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Query not found")

    return {"success": True, "message": "Query deleted from history"}


@router.delete("/workspaces/{workspace_id}/query-history")
async def clear_workspace_history(workspace_id: str):
    """Clear all query history for a workspace."""
    # Verify workspace exists
    workspace = workspace_repository.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    query_history_repo = get_query_history_repository()
    deleted_count = query_history_repo.delete_workspace_history(workspace_id)

    return {
        "success": True,
        "message": f"Deleted {deleted_count} queries from history",
        "deleted_count": deleted_count,
    }
