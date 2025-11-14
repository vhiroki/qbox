"""API endpoints for query operations."""

import csv
import io
import logging
import time
from math import ceil

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    Query,
    QueryCreate,
    QueryExecuteRequest,
    QueryExecuteResult,
    QueryNameUpdateRequest,
    QuerySelections,
    QueryTableSelectionRequest,
    QueryUpdateRequest,
    SQLHistoryItem,
    SQLHistoryList,
    SQLHistoryRestoreRequest,
)
from app.services.ai_service import get_ai_service
from app.services.connection_repository import connection_repository
from app.services.duckdb_manager import get_duckdb_manager
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


@router.patch("/{query_id}/sql", response_model=Query)
async def update_query_sql(query_id: str, request: QueryUpdateRequest):
    """Update the SQL text of a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    success = query_repository.update_query_sql(query_id, request.sql_text)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update query")

    # Return updated query
    updated_query = query_repository.get_query(query_id)
    return updated_query


@router.patch("/{query_id}/name")
async def update_query_name(query_id: str, request: QueryNameUpdateRequest):
    """Update the name of a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    success = query_repository.update_query_name(query_id, request.name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update query")

    # Return updated query
    updated_query = query_repository.get_query(query_id)
    return updated_query


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
        # If it's an S3 file, create a DuckDB view for it
        if selection.source_type == "s3":
            from app.services.s3_service import get_s3_service
            from app.models.schemas import S3ConnectionConfig

            # First, ensure the S3 secret is configured in DuckDB
            # Get connection config
            conn_config = connection_repository.get(selection.connection_id)
            if not conn_config:
                raise HTTPException(
                    status_code=404,
                    detail=f"Connection {selection.connection_id} not found",
                )

            # Configure S3 secret if not already done
            duckdb = get_duckdb_manager()
            if not duckdb.is_attached(selection.connection_id):
                s3_config = S3ConnectionConfig(**conn_config.config)
                duckdb.configure_s3_secret(
                    selection.connection_id,
                    conn_config.name,
                    s3_config,
                    custom_alias=conn_config.alias,
                )
                logger.info(f"Configured S3 secret for connection {selection.connection_id}")

            # Now create the file view
            s3_service = get_s3_service()
            # file_path is stored in table_name for S3 files
            view_name = await s3_service.create_file_view(
                connection_id=selection.connection_id,
                file_path=selection.table_name
            )
            logger.info(f"Created S3 view '{view_name}' for file {selection.table_name}")
        
        query_repository.add_table_selection(
            query_id,
            selection.connection_id,
            selection.schema_name,
            selection.table_name,
            selection.source_type,
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
        # If it's an S3 file, drop the DuckDB view
        if selection.source_type == "s3":
            from app.services.s3_service import get_s3_service
            
            s3_service = get_s3_service()
            view_name = s3_service.get_file_view_name(
                connection_id=selection.connection_id,
                file_path=selection.table_name
            )
            await s3_service.drop_file_view(view_name)
            logger.info(f"Dropped S3 view '{view_name}' for file {selection.table_name}")
        
        success = query_repository.remove_table_selection(
            query_id,
            selection.connection_id,
            selection.schema_name,
            selection.table_name,
            selection.source_type,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Table not found")
        return {"success": True, "message": "Table removed from query"}
    except Exception as e:
        logger.error(f"Failed to remove table selection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove table: {str(e)}")


# Query Execution endpoints


@router.post("/{query_id}/execute", response_model=QueryExecuteResult)
async def execute_query(query_id: str, request: QueryExecuteRequest):
    """Execute a query and return paginated results."""
    start_time = time.time()

    # Verify query exists
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Use SQL from request payload (current editor content)
    if not request.sql_text or request.sql_text.strip() == "":
        raise HTTPException(status_code=400, detail="Query SQL is empty")

    # Get query selections to attach necessary connections
    selections = query_repository.get_query_selections(query_id)
    if not selections:
        raise HTTPException(
            status_code=400,
            detail="No tables selected. Add tables before executing query.",
        )

    try:
        # Get DuckDB manager
        duckdb = get_duckdb_manager()

        # Attach all required connections (skip files as they're already registered as views)
        attached_connections = set()
        for selection in selections:
            # Skip files and S3 - they're already registered as views in DuckDB
            if selection.source_type in ["file", "s3"]:
                continue
                
            if selection.connection_id not in attached_connections:
                # Get connection config
                conn_config = connection_repository.get(selection.connection_id)
                if not conn_config:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Connection {selection.connection_id} not found",
                    )

                # Attach to DuckDB
                from app.models.schemas import PostgresConnectionConfig

                pg_config = PostgresConnectionConfig(**conn_config.config)
                duckdb.attach_postgres(
                    selection.connection_id, conn_config.name, pg_config,
                    custom_alias=conn_config.alias
                )
                attached_connections.add(selection.connection_id)

        # Execute query with pagination
        # Strip trailing semicolons from query
        clean_sql = request.sql_text.strip().rstrip(";")
        
        # First, get total count
        count_query = f"SELECT COUNT(*) as total FROM ({clean_sql}) as subquery"
        _, count_result = duckdb.execute_query(count_query)
        total_rows = count_result[0]["total"] if count_result else 0

        # Calculate pagination
        total_pages = ceil(total_rows / request.page_size)
        offset = (request.page - 1) * request.page_size

        # Execute paginated query
        paginated_query = f"""
            {clean_sql}
            LIMIT {request.page_size}
            OFFSET {offset}
        """

        columns, rows = duckdb.execute_query(paginated_query)

        execution_time = (time.time() - start_time) * 1000  # Convert to ms

        return QueryExecuteResult(
            success=True,
            columns=columns,
            rows=rows,
            total_rows=total_rows,
            page=request.page,
            page_size=request.page_size,
            total_pages=total_pages,
            execution_time_ms=execution_time,
        )

    except Exception as e:
        logger.error(f"Failed to execute query {query_id}: {e}")
        execution_time = (time.time() - start_time) * 1000
        return QueryExecuteResult(
            success=False,
            page=request.page,
            page_size=request.page_size,
            execution_time_ms=execution_time,
            error=str(e),
        )


@router.post("/{query_id}/export")
async def export_query_to_csv(query_id: str, request: QueryExecuteRequest):
    """Export full query results to CSV."""
    # Verify query exists
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Use SQL from request payload (current editor content)
    if not request.sql_text or request.sql_text.strip() == "":
        raise HTTPException(status_code=400, detail="Query SQL is empty")

    # Get query selections to attach necessary connections
    selections = query_repository.get_query_selections(query_id)
    if not selections:
        raise HTTPException(
            status_code=400,
            detail="No tables selected. Add tables before executing query.",
        )

    try:
        # Get DuckDB manager
        duckdb = get_duckdb_manager()

        # Attach all required connections (skip files as they're already registered as views)
        attached_connections = set()
        for selection in selections:
            # Skip files and S3 - they're already registered as views in DuckDB
            if selection.source_type in ["file", "s3"]:
                continue
                
            if selection.connection_id not in attached_connections:
                # Get connection config
                conn_config = connection_repository.get(selection.connection_id)
                if not conn_config:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Connection {selection.connection_id} not found",
                    )

                # Attach to DuckDB
                from app.models.schemas import PostgresConnectionConfig

                pg_config = PostgresConnectionConfig(**conn_config.config)
                duckdb.attach_postgres(
                    selection.connection_id, conn_config.name, pg_config,
                    custom_alias=conn_config.alias
                )
                attached_connections.add(selection.connection_id)

        # Execute full query (no pagination)
        # Strip trailing semicolons from query
        clean_sql = request.sql_text.strip().rstrip(";")
        columns, rows = duckdb.execute_query(clean_sql)

        # Generate CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)

        # Prepare response
        output.seek(0)
        filename = f"{query.name.replace(' ', '_')}.csv"

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        logger.error(f"Failed to export query {query_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to export query: {str(e)}"
        )


# Chat interaction endpoints


@router.post("/{query_id}/chat", response_model=ChatResponse)
async def chat_with_ai(query_id: str, request: ChatRequest):
    """Send a chat message to edit the query SQL interactively."""
    import time
    request_start = time.time()
    
    logger.debug("=" * 100)
    logger.debug(f"📨 Received chat request for query_id: {query_id}")
    logger.debug(f"User message: {request.message}")
    
    # Verify query exists
    query = query_repository.get_query(query_id)
    if not query:
        logger.error(f"Query {query_id} not found")
        raise HTTPException(status_code=404, detail="Query not found")
    
    logger.debug(f"✓ Query found: {query.name}")

    # Get query metadata for context
    logger.debug("Fetching query metadata...")
    metadata_start = time.time()
    try:
        query_metadata = await get_query_metadata(query_id)
        metadata_elapsed = time.time() - metadata_start
        logger.debug(f"✓ Metadata fetched in {metadata_elapsed:.2f}s - {len(query_metadata)} tables")
    except Exception as e:
        logger.error(f"Failed to get query metadata: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get query metadata: {str(e)}",
        )

    if not query_metadata:
        logger.warning("No tables in query")
        raise HTTPException(
            status_code=400,
            detail="No tables in query. Add tables before chatting.",
        )

    # Get chat history for context
    chat_history = query_repository.get_chat_history(query_id)
    logger.debug(f"✓ Chat history: {len(chat_history)} messages")

    # Generate updated SQL using AI (don't save messages until this succeeds)
    logger.debug("Calling AI service...")
    ai_start = time.time()
    try:
        ai_service = get_ai_service()
        result = await ai_service.edit_sql_from_chat(
            current_sql=query.sql_text,
            user_message=request.message,
            chat_history=chat_history,
            query_metadata=query_metadata,
        )
        ai_elapsed = time.time() - ai_start
        logger.debug(f"✓ AI service completed in {ai_elapsed:.2f}s")
    except Exception as e:
        ai_elapsed = time.time() - ai_start
        logger.error(f"AI service failed after {ai_elapsed:.2f}s: {e}")
        # If AI call fails, don't save any messages
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SQL: {str(e)}",
        )

    # Update query SQL
    logger.debug("Updating query SQL...")
    query_repository.update_query_sql(query_id, result["sql"])
    logger.debug("✓ Query SQL updated")

    # Only save messages after successful AI generation
    logger.debug("Saving chat messages...")
    user_message = query_repository.add_chat_message(query_id, "user", request.message)
    assistant_message = query_repository.add_chat_message(
        query_id, "assistant", result.get("explanation", "SQL updated")
    )
    logger.debug("✓ Chat messages saved")

    total_elapsed = time.time() - request_start
    logger.debug(f"✅ Request completed successfully in {total_elapsed:.2f}s")
    logger.debug("=" * 100)

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


# SQL History endpoints


@router.get("/{query_id}/sql-history", response_model=SQLHistoryList)
async def get_sql_history(query_id: str):
    """Get SQL history for a query."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    history = query_repository.get_sql_history(query_id)
    versions = [
        SQLHistoryItem(
            id=h["id"],
            query_id=h["query_id"],
            sql_text=h["sql_text"],
            created_at=h["created_at"],
        )
        for h in history
    ]
    return SQLHistoryList(query_id=query_id, versions=versions)


@router.post("/{query_id}/sql-history/restore", response_model=Query)
async def restore_sql_from_history(query_id: str, request: SQLHistoryRestoreRequest):
    """Restore SQL from a history version."""
    query = query_repository.get_query(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    try:
        restored_sql = query_repository.restore_sql_from_history(query_id, request.history_id)
        if restored_sql is None:
            raise HTTPException(status_code=404, detail="History version not found")

        # Return the updated query
        updated_query = query_repository.get_query(query_id)
        return updated_query

    except Exception as e:
        logger.error(f"Failed to restore SQL from history: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to restore SQL: {str(e)}"
        )
