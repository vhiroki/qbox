from fastapi import APIRouter, HTTPException

from app.models.schemas import AIQueryRequest, QueryRequest, QueryResult
from app.services.ai import ai_service
from app.services.database import connection_manager

router = APIRouter()


@router.post("/execute", response_model=QueryResult)
async def execute_query(request: QueryRequest):
    """Execute a SQL query on a connected data source."""
    datasource = await connection_manager.get_connection(request.connection_id)

    if not datasource:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        columns, rows = await datasource.execute_query(request.query)
        return QueryResult(
            success=True,
            columns=columns,
            rows=rows,
            row_count=len(rows),
        )
    except Exception as e:
        return QueryResult(success=False, error=str(e))


@router.post("/ai-generate", response_model=QueryResult)
async def ai_generate_query(request: AIQueryRequest):
    """Generate and optionally execute a SQL query from natural language."""
    datasource = await connection_manager.get_connection(request.connection_id)

    if not datasource:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        # Get schema for context
        schema = await datasource.get_schema()

        # Generate SQL from prompt
        sql_query = await ai_service.generate_query(request.prompt, schema)

        # If execute flag is set, run the query
        if request.execute:
            columns, rows = await datasource.execute_query(sql_query)
            return QueryResult(
                success=True,
                columns=columns,
                rows=rows,
                row_count=len(rows),
                generated_sql=sql_query,
            )
        else:
            # Just return the generated SQL
            return QueryResult(success=True, generated_sql=sql_query)

    except Exception as e:
        return QueryResult(success=False, error=str(e))
