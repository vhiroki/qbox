"""API endpoints for query operations (renamed from workspace)."""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    Query,
    QueryCreate,
    QuerySelections,
    QueryTableSelectionRequest,
    QueryUpdateRequest,
)
from app.services.ai_service import get_ai_service
from app.services.metadata import get_query_metadata
from app.services.query_repository import query_repository

router = APIRouter(prefix="/queries", tags=["queries"])
logger = logging.getLogger(__name__)


# Query CRUD endpoints


@router.get("/", response_model=list[Query])
async def list_queries():
    """Get all queries."""
    return query_repository.get_all_queries()


@router.post("/", response_model=Query)
async def create_query(query: QueryCreate):
    """Create a new query."""
    try:
        return query_repository.create_query(query.name, query.sql_text)
    except Exception as e:
        logger.error(f"Failed to create query: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create query: {str(e)}")


@router.get("/{query_id}", response_model=Query)
async def get_query(query_id: str):
    """Get a query by ID."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    return query


@router.patch("/{query_id}/sql")
async def update_query_sql(query_id: str, request: QueryUpdateRequest):
    """Update the SQL text of a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    success = query_repository.update_query_sql(query_id, request.sql_text)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update query")

    return {"success": True, "sql_text": request.sql_text}


@router.delete("/{query_id}")
async def delete_query(query_id: str):
    """Delete a query and all its selections and chat history."""
    try:
        success = query_repository.delete_query(query_id)
        if not success:
            raise HTTPException(status_code=404, detail="Query not found")
        return {"success": True, "message": "Query deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete query: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete query: {str(e)}")


# Table selection endpoints


@router.get("/{query_id}/selections", response_model=QuerySelections)
async def get_query_selections(query_id: str):
    """Get all table selections for a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    selections = query_repository.get_query_selections(query_id)
    return QuerySelections(query_id=query_id, selections=selections)


@router.post("/{query_id}/selections")
async def add_query_selection(query_id: str, selection: QueryTableSelectionRequest):
    """Add a table to query selections."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    try:
        query_repository.add_table_selection(
            query_id,
            selection.connection_id,
            selection.schema_name,
            selection.table_name,
        )
        return {"success": True, "message": "Table added to query"}
    except Exception as e:
        logger.error(f"Failed to add table selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add table: {str(e)}")


@router.delete("/{query_id}/selections")
async def remove_query_selection(query_id: str, selection: QueryTableSelectionRequest):
    """Remove a table from query selections."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    try:
        success = query_repository.remove_table_selection(
            query_id,
            selection.connection_id,
            selection.schema_name,
            selection.table_name,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Table not found")
        return {"success": True, "message": "Table removed from query"}
    except Exception as e:
        logger.error(f"Failed to remove table selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove table: {str(e)}")


# Chat interaction endpoints


@router.post("/{query_id}/chat", response_model=ChatResponse)
async def chat_with_ai(query_id: str, request: ChatRequest):
    """Send a chat message to edit the query SQL interactively."""
    # Verify query exists
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Get query metadata for context
    try:
        query_metadata = await get_query_metadata(query_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get query metadata: {str(e)}",
        )

    if not query_metadata:
        raise HTTPException(
            status_code=400,
            detail="No tables in query. Add tables before chatting.",
        )

    # Get chat history for context
    chat_history = query_repository.get_chat_history(query_id)

    # Save user message
    user_message = query_repository.add_chat_message(query_id, "user", request.message)

    # Generate updated SQL using AI
    try:
        ai_service = get_ai_service()
        result = await ai_service.edit_sql_from_chat(
            current_sql=query.sql_text,
            user_message=request.message,
            chat_history=chat_history,
            query_metadata=query_metadata,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SQL: {str(e)}",
        )

    # Update query SQL
    query_repository.update_query_sql(query_id, result["sql"])

    # Save assistant response
    assistant_message = query_repository.add_chat_message(
        query_id, "assistant", result.get("explanation", "SQL updated")
    )

    return ChatResponse(
        message=assistant_message,
        updated_sql=result["sql"],
    )


@router.get("/{query_id}/chat")
async def get_chat_history(query_id: str):
    """Get chat history for a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    chat_history = query_repository.get_chat_history(query_id)
    return {"query_id": query_id, "messages": chat_history}


@router.delete("/{query_id}/chat")
async def clear_chat_history(query_id: str):
    """Clear chat history for a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    query_repository.clear_chat_history(query_id)
    return {"success": True, "message": "Chat history cleared"}
