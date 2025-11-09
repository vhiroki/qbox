from fastapi import APIRouter, HTTPException

from app.models.schemas import QueryRequest, QueryResult
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
