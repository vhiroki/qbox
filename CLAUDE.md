# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QBox is a local data query application that helps build and manage SQL queries across multiple data sources. It features PostgreSQL connections, AI-powered chat for SQL building, table selection with metadata, and query execution using DuckDB.

**Tech Stack:**
- Backend: Python 3.13+, FastAPI, DuckDB, SQLite, uvicorn, uv
- Frontend: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Zustand, pnpm

## Common Commands

### Development

**Backend:**
```bash
cd backend
uv pip install -e .                    # Install dependencies
uvicorn app.main:app --reload --port 8080  # Run server
```

**Frontend:**
```bash
cd frontend
pnpm install                           # Install dependencies
pnpm dev                              # Run dev server (port 5173)
pnpm build                            # Build for production
pnpm lint                             # Run linter
```

**Testing:**
```bash
cd backend
pytest                                # Run all tests
pytest tests/test_specific.py         # Run specific test file
pytest -k test_name                   # Run tests matching pattern
```

### Linting and Formatting

**Python:**
```bash
cd backend
black app/                            # Format code
ruff check app/                       # Lint code
```

**TypeScript:**
```bash
cd frontend
pnpm lint                             # Run ESLint
```

### Ports

- Backend API: http://localhost:8080
- Frontend: http://localhost:5173
- API Docs: http://localhost:8080/docs

### Troubleshooting

Kill processes on ports:
```bash
lsof -ti:8080 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

## Architecture

### Backend Structure (Python + FastAPI)

**Key Directories:**
- `backend/app/api/` - Route handlers (thin layer, HTTP only)
  - `connections.py` - Connection CRUD endpoints
  - `queries.py` - Query management endpoints
  - `query.py` - Query execution and chat endpoints
  - `metadata.py` - Schema metadata endpoints
  - `files.py` - CSV file management
  - `s3.py` - S3 connection endpoints
- `backend/app/services/` - Business logic (thick layer)
  - `duckdb_manager.py` - Persistent DuckDB instance manager
  - `connection_repository.py` - Connection persistence (SQLite)
  - `query_repository.py` - Query persistence (SQLite)
  - `file_repository.py` - File data source persistence
  - `ai_service.py` - OpenAI/LiteLLM integration for SQL chat
  - `metadata.py` - Schema information collection
  - `metadata_collectors.py` - Source-specific metadata collectors
  - `database.py` - SQLite database initialization
- `backend/app/connections/` - Data source connection handlers
  - `postgres/` - PostgreSQL connection implementation
  - `s3/` - S3 connection implementation
- `backend/app/models/schemas.py` - Pydantic models for validation
- `backend/app/config/settings.py` - Application settings

**Persistent Storage:**
- `~/.qbox/connections.db` - SQLite database with:
  - `connections` table: Connection configurations (id, name, type, config JSON, alias, timestamps)
  - `queries` table: Query definitions (id, name, sql_text, created_at, updated_at)
  - `query_selections` table: Selected tables (query_id, connection_id, schema_name, table_name, source_type)
  - `query_chat_history` table: Chat messages (id, query_id, role, message, created_at)
  - `sql_history` table: SQL version history (query_id, sql_text, timestamps)
  - `files` table: CSV/Excel file registrations
  - `settings` table: Application settings
- `~/.qbox/qbox.duckdb` - Persistent DuckDB instance with attached data sources

### Frontend Structure (React + TypeScript)

**Key Directories:**
- `frontend/src/components/` - React components
  - `QueryList.tsx` - Left panel: list of queries
  - `QueryDetail.tsx` - Right panel: query details with tabs
  - `ChatInterface.tsx` - AI chat for SQL editing
  - `ConnectionsTreeView.tsx` - Tree view for connections/schemas/tables
  - `DataSourcesPanel.tsx` - Container for all data sources (connections, files, S3)
  - `S3TreeView.tsx` - Tree view for S3 buckets
  - `ConnectionManager.tsx` - Connection CRUD interface
  - `ui/` - shadcn/ui base components
- `frontend/src/stores/` - Zustand state management
  - `useQueryStore.ts` - Query state and operations
  - `useConnectionStore.ts` - Connection state and metadata cache (5-minute TTL)
  - `useUIStore.ts` - UI state (modals, toasts, loading)
- `frontend/src/services/api.ts` - Backend API client (Axios)
- `frontend/src/types/` - TypeScript type definitions

### Core Architectural Patterns

**DuckDB Manager (Persistent Query Engine):**
- Single persistent instance at `~/.qbox/qbox.duckdb`
- Attaches PostgreSQL databases with aliases: `pg_{connection_id_with_underscores}`
- Registers CSV/Excel files as views
- Attaches S3 buckets with httpfs extension
- Uses system functions for metadata: `duckdb_schemas()`, `duckdb_tables()`, `duckdb_columns()`
- Important: Aliases must use underscores (not hyphens) to avoid SQL identifier errors
- Example: Connection ID `abc123-def456` → alias `pg_abc123_def456`

**Repository Pattern:**
- Separate repositories for connections, queries, and files
- All SQLite operations go through repositories
- Provides clean abstraction over database operations

**Data Flow:**
1. User interacts with React component
2. Component calls Zustand store action
3. Store action makes API call via `services/api.ts`
4. Backend API route delegates to service layer
5. Service performs business logic and repository operations
6. Response flows back with proper typing
7. Store updates state, components re-render

**State Management (Zustand):**
- `useQueryStore`: Manages queries, selections, chat history
- `useConnectionStore`: Manages connections, caches metadata (5-minute TTL)
- `useUIStore`: Manages modals, toasts, loading states
- Granular selectors prevent unnecessary re-renders
- Redux DevTools integration for debugging

**Metadata Caching:**
- Frontend stores metadata in `useConnectionStore` with 5-minute TTL
- Backend collects metadata on-demand using DuckDB system functions
- Metadata includes: schemas, tables, columns, types, nullable, primary keys, row counts

**Query Architecture:**
- **Query**: Named SQL query with selected tables from one or multiple sources
- **Connection**: Saved PostgreSQL connection configuration
- **Data Source Types**: 'connection' (PostgreSQL), 'file' (CSV/Excel), 's3' (S3 buckets)
- **Chat History**: User-AI conversation stored per query for iterative SQL editing
- **SQL History**: Last 50 SQL versions per query for version tracking

### Extensible Data Sources

The `source_type` field in `query_selections` supports multiple data source types:
- **'connection'**: PostgreSQL databases (current)
- **'file'**: CSV/Excel files (in progress)
- **'s3'**: S3 buckets (in progress)

When adding tables to a query, the UI shows all data sources in a unified tree view with filtering and real-time selection.

## Code Style Standards

### Python

- Follow PEP 8 (Black formatting, Ruff linting)
- Line length: 100 characters
- Type hints required for all functions
- Use async/await for I/O operations
- Dataclasses or Pydantic models for structured data
- Descriptive variable names
- Docstrings for public functions

### TypeScript/React

- Functional components with hooks only (no classes)
- Strict TypeScript mode
- No `any` type - use proper types or `unknown`
- Explicit types for all props and state
- Async/await for API calls
- Try/catch with user-friendly error messages
- Export types separately from components

### Prefer

✅ Async/await over callbacks
✅ Type hints and interfaces
✅ Repository pattern for data persistence
✅ Small, single-purpose functions
✅ Explicit error handling
✅ RESTful API design
✅ Functional React components with hooks
✅ TailwindCSS utilities over custom CSS
✅ shadcn/ui components
✅ Zustand stores for shared state

### Avoid

❌ Global state (use Zustand stores)
❌ Blocking I/O operations
❌ Hardcoded values
❌ Complex class hierarchies
❌ Browser-specific code (won't work in Electron)
❌ Direct DOM manipulation
❌ Synchronous database operations
❌ Storing credentials in code
❌ Dark/light theme toggles (dark theme only)
❌ Custom CSS when TailwindCSS utilities exist

## Error Handling

**Backend:**
- Validate all input with Pydantic models
- Return appropriate HTTP status codes
- Log technical details with `logging` module
- Never log sensitive data (passwords, API keys)

**Frontend:**
- Try/catch around all async operations
- Display user-friendly error messages via toast notifications
- Show loading states during operations
- Validate user input before API calls

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
- Debounce user input in search/filter fields
- Metadata queries use efficient DuckDB system functions

## Electron-Ready Design

The application is designed to be packaged as an Electron desktop app:
- Backend and frontend communicate only via REST API
- Use localhost URLs (avoid hardcoded IPs)
- Cross-platform file paths
- Avoid browser-specific APIs
- State in backend where possible
- Backend will run as child process in Electron
