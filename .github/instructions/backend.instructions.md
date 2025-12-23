# Backend Instructions (Python + FastAPI)

applyTo: backend/**

## Code Style Standards

- Follow PEP 8 (Black formatting, Ruff linting)
- Line length: 100 characters
- Type hints required for all functions
- Use async/await for I/O operations
- Dataclasses or Pydantic models for structured data
- Descriptive variable names
- Docstrings for public functions

## Linting and Formatting

```bash
cd backend
black app/                            # Format code
ruff check app/                       # Lint code
```

## Architecture

**API Layer (`backend/app/api/`)** - Thin layer, HTTP only:
- `connections.py` - Connection CRUD endpoints
- `queries.py` - Query management endpoints
- `query.py` - Query execution and chat endpoints
- `metadata.py` - Schema metadata endpoints
- `files.py` - CSV file management
- `s3.py` - S3 connection endpoints

**Services Layer (`backend/app/services/`)** - Thick layer, business logic:
- `duckdb_manager.py` - Persistent DuckDB instance manager
- `connection_repository.py` - Connection persistence (SQLite)
- `query_repository.py` - Query persistence (SQLite)
- `file_repository.py` - File data source persistence
- `ai_service.py` - OpenAI/LiteLLM integration for SQL chat
- `metadata.py` - Schema information collection
- `metadata_collectors.py` - Source-specific metadata collectors
- `database.py` - SQLite database initialization

**Connections (`backend/app/connections/`)** - Data source handlers:
- `postgres/` - PostgreSQL connection implementation
- `s3/` - S3 connection implementation

**Models (`backend/app/models/schemas.py`)** - Pydantic models for validation

**Config (`backend/app/config/settings.py`)** - Application settings

## Prefer

✅ Async/await over callbacks
✅ Type hints for all functions
✅ Repository pattern for data persistence
✅ Small, single-purpose functions
✅ Explicit error handling
✅ RESTful API design
✅ Pydantic models for validation

## Avoid

❌ Blocking I/O operations
❌ Hardcoded values
❌ Complex class hierarchies
❌ Synchronous database operations
❌ Storing credentials in code
❌ Logging sensitive data (passwords, API keys)

## Error Handling

- Validate all input with Pydantic models
- Return appropriate HTTP status codes
- Log technical details with `logging` module
- Never log sensitive data (passwords, API keys)

## Security

- Never log sensitive data (passwords, API keys)
- Use environment variables for secrets
- Validate all user input
- Sanitize file paths for CSV/Excel access
- Connection credentials stored in local SQLite database only

## Performance

- Cache schema metadata with 5-minute TTL
- Use connection pooling where appropriate
- Limit query result sizes
- Metadata queries use efficient DuckDB system functions

## DuckDB Manager Patterns

- Single persistent instance at `~/.qbox/qbox.duckdb`
- **PostgreSQL**: Attaches databases with identifiers derived from connection names
  - Example: Connection "My Database" → `ATTACH AS my_database`
  - Tables referenced as: `my_database.schema.table`
- **S3**: Creates schema and secret for each connection
  - Example: Connection "Production S3" → `CREATE SCHEMA production_s3` + `CREATE SECRET production_s3`
  - Files referenced as: `production_s3.sales_2024` (schema-qualified views)
- **CSV/Excel files**: Registered as flat views without schema prefix
  - Example: `file_sales_data`
- Uses system functions for metadata: `duckdb_schemas()`, `duckdb_tables()`, `duckdb_columns()`
- Important: Identifiers use underscores (not hyphens) to avoid SQL identifier errors
