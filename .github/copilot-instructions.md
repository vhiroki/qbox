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
- **SQLite**: Local persistence for connections and workspace selections
- **uvicorn**: ASGI server
- **uv**: Package management

### Frontend
- **React 18**: UI library
- **TypeScript 5+**: Type safety
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

Example:
```python
async def execute_query(self, query: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Execute a SQL query and return columns and rows."""
    if not self.duckdb_conn:
        raise RuntimeError("Not connected to database")
    # Implementation...
```

### TypeScript/React
- Use functional components with TypeScript interfaces
- Props should have explicit types
- Avoid `any` type - use proper types or `unknown`
- Use async/await for API calls
- Handle errors with try/catch and user-friendly messages
- Export types separately from components

Example:
```typescript
interface QueryResultProps {
  result: QueryResult | null;
  loading: boolean;
}

export default function QueryResult({ result, loading }: QueryResultProps) {
  // Implementation...
}
```

## Project Structure Rules

### Backend Directory Structure
```
backend/app/
├── api/                    # Route handlers (thin layer)
│   ├── connections.py      # Connection CRUD
│   ├── metadata.py         # Metadata collection
│   ├── queries.py          # Query CRUD and chat interaction
│   └── query.py            # Query execution (deprecated, use queries.py)
├── services/               # Business logic (thick layer)
│   ├── duckdb_manager.py   # Persistent DuckDB instance
│   ├── database.py         # Database abstraction
│   ├── metadata.py         # Metadata collection service
│   ├── ai_service.py       # AI integration for SQL editing
│   ├── connection_repository.py  # SQLite connection persistence
│   └── query_repository.py       # SQLite query and chat history persistence
├── models/                 # Pydantic models and schemas
├── config/                 # Settings and configuration
└── utils/                  # Helper functions (if needed)
```

### Frontend Directory Structure
```
frontend/src/
├── components/             # React components
│   ├── ConnectionManager.tsx    # Connection CRUD interface
│   ├── ConnectionForm.tsx       # Connection creation/edit form
│   ├── QueryList.tsx            # Left panel: list of queries
│   ├── QueryDetail.tsx          # Right panel: query details with chat and table cards
│   ├── ChatInterface.tsx        # AI chat for interactive SQL editing
│   ├── AddTablesModal.tsx       # Multi-step modal for adding tables
│   ├── MetadataSidebar.tsx      # Metadata tree view (if used)
│   └── ui/                      # shadcn/ui components
├── services/               # API client and external services
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks (if needed)
├── utils/                  # Helper functions
├── lib/                    # Utility libraries (cn helper, etc.)
└── App.tsx                 # Main app with top navigation
```

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
- Metadata is collected per connection on demand (when "Add to Workspace" is clicked)
- PostgreSQL: Uses information_schema queries to get tables, columns, constraints
- Includes: table names, column names/types, nullable, primary keys, row counts
- Future: Add descriptions, foreign keys, indexes

## Security & Best Practices

### Security
- Never log sensitive data (passwords, API keys)
- Passwords stored in SQLite connections.db (consider encryption for production)
- Use environment variables for secrets (if/when needed)
- Validate all user input
- Sanitize file paths for CSV/Excel access
- In Electron: use `contextIsolation` and disable `nodeIntegration`

### Error Handling
- Use try/catch for all async operations
- Return user-friendly error messages
- Log technical details server-side
- Show loading states during operations
- Provide retry mechanisms where appropriate

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

### REST Endpoints
- Use proper HTTP methods (GET, POST, DELETE, etc.)
- Return consistent response formats
- Include success/error flags in responses
- Use HTTP status codes correctly
- Version APIs if needed (`/api/v1/...`)

### Request/Response Models
```python
# Connection
class ConnectionConfig(BaseModel):
    name: str
    type: Literal["postgres", "s3", "csv", "excel"]
    config: dict

# Metadata
class ConnectionMetadata(BaseModel):
    connection_id: str
    connection_name: str
    source_type: str
    schemas: list[SchemaMetadata]

# Query
class Query(BaseModel):
    id: str
    name: str
    sql_text: str
    created_at: str
    updated_at: str

class QueryTableSelection(BaseModel):
    query_id: str
    connection_id: str
    schema_name: str
    table_name: str

# Chat
class ChatMessage(BaseModel):
    id: int
    query_id: str
    role: Literal["user", "assistant"]
    message: str
    created_at: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    message: ChatMessage
    updated_sql: str
```

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

### Current Development
- All API calls use relative URLs or configurable base URLs
- No browser-specific APIs (no `window.location`, prefer React Router)
- File operations should use APIs, not direct file system access
- Think about window management (multiple windows in the future?)

### Future Electron Features
- Native file picker for CSV/Excel
- System tray integration
- Native menus and keyboard shortcuts
- Auto-updates
- Offline mode support
- Better error dialogs using native notifications

## Common Patterns

### Loading Query on Startup (Frontend)
```typescript
useEffect(() => {
  const loadQueryData = async () => {
    // 1. Get query info
    const query = await api.getQuery(queryId);
    
    // 2. Get query selections
    const { selections } = await api.getQuerySelections(queryId);
    
    // 3. Get chat history
    const chatHistory = await api.getChatHistory(queryId);
    
    // 4. Display selections with their metadata
    // Metadata is fetched on-demand when viewing table details
  };
  loadQueryData();
}, [queryId]);
```

### Table Selection Pattern (Frontend)
```typescript
const handleAddTables = async () => {
  // 1. Open multi-step modal
  // 2. Select connection
  const metadata = await api.getMetadata(connectionId);
  
  // 3. Select schema
  // 4. Select tables
  
  // 5. Add each selected table to query
  for (const tableName of selectedTables) {
    await api.addQuerySelection(queryId, {
      connection_id: connectionId,
      schema_name: schemaName,
      table_name: tableName,
    });
  }
};
```

### Chat Interaction Pattern (Frontend)
```typescript
const handleSendMessage = async () => {
  const response = await api.chatWithAI(queryId, {
    message: userMessage,
  });
  
  // Add chat message to history
  setChatHistory(prev => [...prev, response.message]);
  
  // Update SQL text
  setSqlText(response.updated_sql);
  
  // Update parent component
  onSQLUpdate({ ...query, sql_text: response.updated_sql });
};
```

### API Call Pattern (Frontend)
```typescript
const [data, setData] = useState<DataType | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await api.someMethod();
    setData(result);
  } catch (err: any) {
    setError(err.response?.data?.detail || 'An error occurred');
  } finally {
    setLoading(false);
  }
};
```

### Service Layer Pattern (Backend)
```python
class QueryRepository:
    """SQLite persistence for queries and selections."""
    
    def create_query(self, name: str, sql_text: str = "") -> Query:
        # INSERT into queries
        
    def get_all_queries(self) -> list[Query]:
        # SELECT * from queries
        
    def delete_query(self, query_id: str) -> bool:
        # DELETE query and all selections + chat history (CASCADE)
    
    def add_table_selection(self, query_id: str, connection_id: str, 
                     schema_name: str, table_name: str):
        # INSERT into query_selections
        
    def remove_table_selection(self, query_id: str, connection_id: str,
                        schema_name: str, table_name: str):
        # DELETE from query_selections
        
    def get_query_selections(self, query_id: str) -> list[QueryTableSelection]:
        # SELECT * from query_selections WHERE query_id = ?
    
    def add_chat_message(self, query_id: str, role: str, message: str) -> ChatMessage:
        # INSERT into query_chat_history
    
    def get_chat_history(self, query_id: str) -> list[ChatMessage]:
        # SELECT * from query_chat_history WHERE query_id = ? ORDER BY created_at
```

### Metadata Collection Pattern (Backend)
```python
async def collect_postgres_metadata(connection_id: str, config: PostgresConnectionConfig) -> ConnectionMetadata:
    # 1. Connect to database
    # 2. Query information_schema for schemas
    # 3. For each schema, get tables
    # 4. For each table, get columns and constraints
    # 5. Return structured metadata
```

## When to Ask for Clarification

Ask the user when:
- Adding new data source types (implementation details needed)
- Changing API contracts (breaking changes)
- Adding new dependencies (approval needed)
- Security-sensitive features (credentials, encryption)
- Major architectural decisions (state management, caching strategy)
- UI/UX changes that affect the workspace workflow

## Documentation

- **Do NOT create separate documentation files for every change**
- Update existing documentation (README.md, ARCHITECTURE.md) only when significant features are added
- Code comments are preferred for explaining complex logic
- Let git commit messages serve as change documentation

## Prefer

- ✅ Async/await over callbacks
- ✅ Type hints and interfaces over dynamic typing
- ✅ Repository pattern for data persistence
- ✅ Small, focused functions over large monolithic ones
- ✅ Explicit error handling over silent failures
- ✅ Configuration via environment variables (when needed)
- ✅ RESTful API design
- ✅ Functional React components with hooks
- ✅ TailwindCSS utility classes over custom CSS
- ✅ shadcn/ui components over building from scratch

## Avoid

- ❌ Global state (use React state or backend persistence)
- ❌ Blocking I/O operations
- ❌ Hardcoded values (use constants or config)
- ❌ Complex class hierarchies
- ❌ Browser-specific code that won't work in Electron
- ❌ Direct DOM manipulation (use React)
- ❌ Synchronous database operations
- ❌ Storing credentials in code or version control
- ❌ Theme toggles or light mode (dark theme only)
- ❌ Custom CSS when TailwindCSS utilities exist

## Git Commit Style

Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Tests
- `chore:` Maintenance tasks

Example: `feat: add schema-level checkbox selection to workspace`

## Priority Order for Development

1. **Core Functionality**: Database connections, query management, metadata collection, AI chat integration
2. **User Experience**: Loading states, error handling, responsive design
3. **Extensibility**: Easy to add new data sources
4. **Testing**: Ensure reliability
5. **Documentation**: Keep README and code comments updated
6. **Optimization**: Performance improvements
7. **Polish**: UI refinements, animations

## Remember

- This app will become an Electron desktop application - design accordingly
- Keep frontend and backend loosely coupled
- Focus on local-first experience with SQLite persistence
- Security is important (handling database credentials)
- Performance matters (working with potentially large datasets)
- User experience should feel native and fast
- Dark theme only - no light mode or theme switching
- Query is the main concept - everything revolves around interactive SQL editing with AI assistance and table metadata viewing
