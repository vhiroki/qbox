# GitHub Copilot Instructions for QBox

## Project Overview
QBox is a query-based data management application that helps users build and manage SQL queries across multiple sources. Users can create queries, connect to PostgreSQL databases, select tables to add to each query, use AI-powered chat to interactively build SQL, and view comprehensive metadata. The app runs locally with a Python FastAPI backend and React TypeScript frontend, designed to be packaged as an Electron desktop application in the future.

For detailed setup and usage instructions, see the [README](../README.md).

## Core Architecture Principles

### Backend (Python + FastAPI)
- Use FastAPI for all API endpoints
- DuckDB is the query engine - maintain a persistent instance that can attach multiple data sources
- SQLite for persistence: connection configurations, queries, query table selections, and chat history stored in `~/.qbox/connections.db`
- Keep the backend as a standalone service that communicates via REST API
- All business logic should be in the `services/` directory
- Use Pydantic models for data validation and serialization
- Repository pattern for data persistence (connection_repository, query_repository)
- Environment variables for configuration (use `pydantic-settings`)
- AI integration via OpenAI for interactive SQL editing

### Frontend (React + TypeScript)
- Use functional components with hooks (no class components)
- TypeScript for all code (strict mode enabled)
- Keep components small and focused
- **Zustand for state management** - centralized stores for queries, connections, and UI state
- TailwindCSS for styling with shadcn/ui component library
- Dark theme only (no theme toggle)
- API calls should go through the `services/api.ts` client
- Handle loading and error states gracefully
- Design for desktop UX (keyboard shortcuts, native-feeling interactions)
- Two-page structure: **Queries** (main view with query list and detail) and **Connections** (management)

### Electron-Ready Development
- **Keep frontend and backend decoupled** - they should communicate only via REST API
- **Use localhost URLs** - avoid hardcoded IPs
- **File paths should be cross-platform** - use path libraries correctly
- **Avoid browser-specific APIs** - think about Node.js/Electron environment
- **Keep state in backend where possible** - easier to manage in Electron
- **Plan for subprocess management** - backend will run as child process in Electron

## Technology Stack

### Backend
- **Python 3.13+**: Modern Python features
- **FastAPI**: Async web framework
- **DuckDB**: Embedded analytical database (persistent instance at `~/.qbox/qbox.duckdb`)
- **SQLite**: Local persistence for connections and query data
- **uvicorn**: ASGI server
- **uv**: Package management

### Frontend
- **React 18**: UI library
- **TypeScript 5+**: Type safety
- **Zustand**: Lightweight state management with Redux DevTools
- **Vite**: Build tool (fast, Electron-compatible)
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React component library
- **Axios**: HTTP client
- **pnpm**: Package management

## Code Style Guidelines

### Python
- Follow PEP 8 (enforced by Black and Ruff)
- Use type hints for all functions
- Prefer async/await for I/O operations
- Use dataclasses or Pydantic models for structured data
- Keep functions small and single-purpose
- Use descriptive variable names
- Include docstrings for public functions

### TypeScript/React
- Use functional components with TypeScript interfaces
- Props should have explicit types
- Avoid `any` type - use proper types or `unknown`
- Use async/await for API calls
- Handle errors with try/catch and user-friendly messages
- Export types separately from components

## Project Structure Rules

### Backend Organization
- **api/**: Route handlers (thin layer) - handle HTTP requests/responses only
- **services/**: Business logic (thick layer) - all core functionality lives here
- **models/**: Pydantic models and schemas for validation and serialization
- **config/**: Application settings and configuration
- Repository pattern for data persistence (connection_repository, query_repository)

### Frontend Organization
- **components/**: React components (keep small and focused)
  - **ui/**: shadcn/ui base components
- **stores/**: Zustand state management stores
  - **useQueryStore.ts**: Query state and operations
  - **useConnectionStore.ts**: Connection state and metadata cache
  - **useUIStore.ts**: UI state (modals, toasts, loading)
- **services/**: API client and external service integrations
- **types/**: TypeScript type definitions
- **hooks/**: Custom React hooks
- **utils/**: Helper functions
- **lib/**: Utility libraries

## Query Architecture

### Core Concepts

**Query**: A named SQL query with connected tables from one or more data sources. Each query is independent and can contain tables from multiple connections. Queries are persisted in SQLite with SQL text, chat history, and table selections automatically restored on app startup.

**Connection**: A saved database connection configuration (PostgreSQL). Stored in SQLite with credentials.

**Metadata**: Schema information (tables, columns, types, constraints) automatically collected from data sources.

**Chat History**: Conversational messages between user and AI for iterative SQL editing. Stored per query.

### Query Flow
1. User creates a query (gives it a name)
2. User creates database connections (stored in SQLite)
3. User clicks "Add Tables" within a query
4. User selects a connection, then a schema, then specific tables
5. Selected tables are added to the query (persisted to SQLite)
6. Selected tables appear as cards with full metadata in the query detail view
7. User can chat with AI to build/edit SQL interactively
8. User can view table details by clicking on cards
9. User can remove tables or delete entire queries

### DuckDB Manager
- Single persistent DuckDB instance at `~/.qbox/qbox.duckdb`
- Connections are attached with aliases: `pg_{connection_id_with_underscores}`
- Important: Aliases must have `pg_` prefix and use underscores (not hyphens) to avoid identifier errors
- Example: `pg_abc123_def456` for connection ID `abc123-def456`

### Persistence Layer
- **connections.db**: SQLite database with four tables:
  - `connections`: Connection configurations (id, name, type, config JSON, timestamps)
  - `queries`: Query definitions (id, name, sql_text, created_at, updated_at)
  - `query_selections`: Selected tables (query_id, connection_id, schema_name, table_name)
  - `query_chat_history`: Chat messages (id, query_id, role, message, created_at)
- Repository pattern: `connection_repository.py` and `query_repository.py`

## Data Source Guidelines

### Adding New Data Sources
- Extend the `DataSource` abstract class
- Implement all required methods: `connect()`, `disconnect()`, `execute_query()`, `get_schema()`
- Use DuckDB extensions where available (postgres, sqlite, parquet, etc.)
- Store minimal connection info (don't cache large datasets)
- Handle connection failures gracefully

### Supported Data Sources (Current & Future)
1. ✅ PostgreSQL (current)
2. 🔜 CSV files
3. 🔜 Excel files
4. 🔜 S3 buckets
5. 🔜 SQLite
6. 🔜 MySQL/MariaDB

### Metadata Collection
- Metadata is collected per connection on demand
- Uses information_schema queries to get tables, columns, constraints
- Includes: table names, column names/types, nullable, primary keys, row counts

## Best Practices

### Security
- Never log sensitive data (passwords, API keys)
- Use environment variables for secrets
- Validate all user input
- Sanitize file paths for CSV/Excel access
- In Electron: use `contextIsolation` and disable `nodeIntegration`

### Performance
- Cache schema information where reasonable
- Use connection pooling if needed
- Limit query result sizes (add LIMIT clauses)
- Stream large results if possible
- Debounce user input in search/filter fields

## UI/UX Patterns

### App Structure
- **Top Navigation Bar**: Switch between Queries and Connections pages
- **Queries Page**:
  - Left panel (320px): List of all queries with create button (QueryList)
  - Right panel: Selected query details with chat interface and table cards (QueryDetail)
  - Add Tables Modal: Multi-step process (connection → schema → tables selection)
  - Chat & SQL Tab: Interactive SQL editing with AI assistant
- **Connections Page**: CRUD interface for database connections

### Component Patterns

**QueryList** (Left Panel):
- List of all queries ordered by newest first
- Click to select a query
- Create Query button at top
- Shows query name and last updated date

**QueryDetail** (Right Panel):
- Header with query name and actions (Add Tables, Delete Query)
- Two tabs: "Chat & SQL" and "Connected Tables"
- Chat & SQL tab: ChatInterface component with SQL editor and chat history
- Connected Tables tab: Table cards showing all selected tables
- Each card displays: connection name, schema, table name, column count, row count
- Click card to view detailed metadata in a dialog
- X button on each card to remove from query
- Empty state when no tables selected

**ChatInterface** (Chat & SQL Tab):
- SQL editor (editable textarea) showing current SQL
- Chat message history with user/assistant bubbles
- Input field and send button for new messages
- AI iteratively refines SQL based on conversation context
- Save SQL button when manually edited
- Clear chat history button

**AddTablesModal** (Multi-Step):
- Step 1: Select a connection from saved connections
- Step 2: Select a schema from the connection
- Step 3: Select tables with checkboxes and search filter
- Progress indicator showing current step
- Back/Next/Cancel buttons for navigation

**ConnectionManager**:
- Table view of all saved connections
- Actions: "Edit", "Delete" buttons
- "Create New Connection" button in header and empty state
- Dialog forms for create/edit

### API Patterns
- Use proper HTTP methods (GET, POST, DELETE, etc.)
- Return consistent response formats
- Include success/error flags in responses
- Use HTTP status codes correctly
- Version APIs if needed (`/api/v1/...`)
- Use Pydantic models for request/response validation

## Testing Approach

### Backend Tests
- Write tests for all service layer functions
- Mock external dependencies (OpenAI, databases)
- Test error cases and edge cases
- Use pytest and pytest-asyncio

### Frontend Tests
- Test component rendering
- Test user interactions
- Mock API calls
- Use React Testing Library (when implemented)

## Electron Migration Considerations

- All API calls use relative URLs or configurable base URLs
- No browser-specific APIs (prefer React Router)
- File operations should use APIs, not direct file system access
- Backend will run as child process in Electron
- Think about native features: file pickers, system tray, native menus, auto-updates

## State Management with Zustand

### Store Architecture
- **useQueryStore**: Manages all query-related state (queries list, selections, chat history)
- **useConnectionStore**: Manages connections and caches metadata for performance
- **useUIStore**: Manages UI state (modal visibility, toasts, global loading)

### Store Patterns
```typescript
// Reading from store (granular selectors for optimized re-renders)
const queries = useQueryStore((state) => state.queries);
const isLoading = useQueryStore((state) => state.isLoading);

// Calling store actions
const createQuery = useQueryStore((state) => state.createQuery);
await createQuery("My Query");

// Accessing derived state
const query = queries.find((q) => q.id === queryId);
const selections = querySelections.get(queryId) || [];
```

### Benefits
- **Centralized state**: Single source of truth for all data
- **Automatic reactivity**: Components re-render when subscribed data changes
- **Performance**: Metadata caching, granular selectors, no prop drilling
- **DevTools**: Redux DevTools integration for debugging
- **Type-safe**: Full TypeScript support with strict mode

### Best Practices
- Use granular selectors to avoid unnecessary re-renders
- Keep store actions async and handle errors within the store
- Cache expensive data (like metadata) in stores
- Use devtools middleware for debugging
- Avoid local state for data that should be shared across components

## Testing Approach

### Frontend State Management
- Use Zustand stores for shared application state
- Use local useState for UI-only state (form inputs, toggles)
- Fetch data through store actions on component mount
- Handle loading, error, and success states via stores
- Use async/await for API calls with try/catch error handling
- Stores handle all API integration and state updates

### Backend Service Layer
- Repository pattern for database operations
- Separate concerns: API layer (thin) handles HTTP, service layer (thick) contains business logic
- Use Pydantic models for data validation
- Return structured responses with proper typing
- Handle errors with appropriate HTTP status codes

### Data Flow Pattern
1. User interacts with UI component
2. Component calls Zustand store action
3. Store action makes API call through `services/api.ts`
4. Backend API route delegates to service layer
5. Service layer performs business logic and database operations
6. Response flows back through layers with proper typing
7. Store updates state automatically
8. All subscribed components re-render with new data

### Error Handling Pattern
- Try/catch blocks around all async operations
- Display user-friendly error messages
- Show loading states during operations
- Provide retry mechanisms where appropriate
- Validate input with Pydantic models (backend)
- Return appropriate HTTP status codes (backend)
- Log technical details server-side (backend)

## Prefer & Avoid

### Prefer
- ✅ Async/await over callbacks
- ✅ Type hints and interfaces over dynamic typing
- ✅ Repository pattern for data persistence
- ✅ Small, focused functions over large monolithic ones
- ✅ Explicit error handling over silent failures
- ✅ RESTful API design
- ✅ Functional React components with hooks
- ✅ TailwindCSS utility classes over custom CSS
- ✅ shadcn/ui components over building from scratch

### Avoid
- ❌ Local state for shared data (use Zustand stores)
- ❌ Prop drilling (use stores instead)
- ❌ Blocking I/O operations
- ❌ Hardcoded values (use constants or config)
- ❌ Complex class hierarchies
- ❌ Browser-specific code that won't work in Electron
- ❌ Direct DOM manipulation (use React)
- ❌ Synchronous database operations
- ❌ Storing credentials in code or version control
- ❌ Dark/light theme toggles (dark theme only)
- ❌ Custom CSS when TailwindCSS utilities exist
