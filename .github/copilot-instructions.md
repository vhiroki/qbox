# GitHub Copilot Instructions for QBox

## Project Overview
QBox is an AI-powered data query application that helps users query and work with data from multiple sources (PostgreSQL, S3, CSV, Excel) using natural language prompts. The app runs locally with a Python FastAPI backend and React TypeScript frontend, designed to be packaged as an Electron desktop application in the future.

## Core Architecture Principles

### Backend (Python + FastAPI)
- Use FastAPI for all API endpoints
- DuckDB is the query engine for all data sources
- Keep the backend as a standalone service that communicates via REST API
- All business logic should be in the `services/` directory
- Use Pydantic models for data validation and serialization
- Keep connections stateless where possible (ready for Electron packaging)
- Environment variables for configuration (use `pydantic-settings`)

### Frontend (React + TypeScript)
- Use functional components with hooks (no class components)
- TypeScript for all code (strict mode enabled)
- Keep components small and focused
- Use inline styles or CSS modules (avoid complex CSS-in-JS libraries for Electron compatibility)
- API calls should go through the `services/api.ts` client
- Handle loading and error states gracefully
- Design for desktop UX (keyboard shortcuts, native-feeling interactions)

### Electron-Ready Development
- **Keep frontend and backend decoupled** - they should communicate only via REST API
- **Use localhost URLs** - avoid hardcoded IPs
- **File paths should be cross-platform** - use path libraries correctly
- **Avoid browser-specific APIs** - think about Node.js/Electron environment
- **Keep state in backend where possible** - easier to manage in Electron
- **Plan for subprocess management** - backend will run as child process in Electron

## Technology Stack

### Backend
- **Python 3.11+**: Modern Python features
- **FastAPI**: Async web framework
- **DuckDB**: Embedded analytical database
- **OpenAI API**: For AI-powered SQL generation
- **uvicorn**: ASGI server
- **uv**: Package management

### Frontend
- **React 18**: UI library
- **TypeScript 5+**: Type safety
- **Vite**: Build tool (fast, Electron-compatible)
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
├── api/           # Route handlers (thin layer)
├── services/      # Business logic (thick layer)
├── models/        # Pydantic models and schemas
├── config/        # Settings and configuration
└── utils/         # Helper functions (if needed)
```

### Frontend Directory Structure
```
frontend/src/
├── components/    # React components
├── services/      # API client and external services
├── types/         # TypeScript type definitions
├── hooks/         # Custom React hooks
├── utils/         # Helper functions
└── constants/     # App constants
```

## AI Service Guidelines

### Multiple Provider Support
- Use abstract base class for AI providers
- Keep provider-specific code isolated
- Make it easy to add new providers (Claude, local models, etc.)
- Store provider choice in settings

Example pattern:
```python
class AIProvider(ABC):
    @abstractmethod
    async def generate_sql(self, prompt: str, schema: list[TableSchema]) -> str:
        pass

class OpenAIProvider(AIProvider):
    # Implementation

class ClaudeProvider(AIProvider):
    # Implementation
```

## Data Source Guidelines

### Adding New Data Sources
- Extend the `DataSource` abstract class
- Implement all required methods: `connect()`, `disconnect()`, `execute_query()`, `get_schema()`
- Use DuckDB extensions where available (postgres, sqlite, parquet, etc.)
- Store minimal connection info (don't cache large datasets)
- Handle connection failures gracefully

### Supported Data Sources (Current & Future)
1. ✅ PostgreSQL (MVP)
2. 🔜 CSV files
3. 🔜 Excel files
4. 🔜 S3 buckets
5. 🔜 SQLite
6. 🔜 MySQL/MariaDB

## Security & Best Practices

### Security
- Never log sensitive data (passwords, API keys)
- Use environment variables for secrets
- Validate all user input (SQL injection prevention)
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

## API Design Patterns

### REST Endpoints
- Use proper HTTP methods (GET, POST, DELETE, etc.)
- Return consistent response formats
- Include success/error flags in responses
- Use HTTP status codes correctly
- Version APIs if needed (`/api/v1/...`)

### Request/Response Models
```python
# Request
class QueryRequest(BaseModel):
    connection_id: str
    query: str

# Response
class QueryResult(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
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
class SomeService:
    def __init__(self, dependency: Dependency):
        self.dependency = dependency
    
    async def do_something(self, input: InputModel) -> OutputModel:
        try:
            result = await self.dependency.operation()
            return OutputModel(success=True, data=result)
        except Exception as e:
            logger.error(f"Error in do_something: {e}")
            return OutputModel(success=False, error=str(e))
```

## When to Ask for Clarification

Ask the user when:
- Adding new data source types (implementation details needed)
- Changing API contracts (breaking changes)
- Adding new dependencies (approval needed)
- Security-sensitive features (credentials, file access)
- Major architectural decisions (state management, caching strategy)

## Documentation

- **Do NOT create separate documentation files for every change**
- Update existing documentation (README.md, ARCHITECTURE.md) only when significant features are added
- Code comments are preferred for explaining complex logic
- Let git commit messages serve as change documentation

## Prefer

- ✅ Async/await over callbacks
- ✅ Type hints and interfaces over dynamic typing
- ✅ Composition over inheritance
- ✅ Small, focused functions over large monolithic ones
- ✅ Explicit error handling over silent failures
- ✅ Configuration via environment variables
- ✅ RESTful API design
- ✅ Functional React components with hooks

## Avoid

- ❌ Global state (use Context or props)
- ❌ Blocking I/O operations
- ❌ Hardcoded values (use constants or config)
- ❌ Complex class hierarchies
- ❌ Browser-specific code that won't work in Electron
- ❌ Direct DOM manipulation (use React)
- ❌ Synchronous database operations
- ❌ Storing credentials in code or version control

## Git Commit Style

Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Tests
- `chore:` Maintenance tasks

Example: `feat: add CSV file support to data sources`

## Priority Order for Development

1. **Core Functionality**: Database connections, queries, AI integration
2. **User Experience**: Loading states, error handling, responsive design
3. **Extensibility**: Easy to add new data sources and AI providers
4. **Testing**: Ensure reliability
5. **Documentation**: Keep README and code comments updated
6. **Optimization**: Performance improvements
7. **Polish**: UI refinements, animations

## Remember

- This app will become an Electron desktop application - design accordingly
- Keep frontend and backend loosely coupled
- Focus on local-first experience
- Security is important (handling database credentials)
- Performance matters (working with potentially large datasets)
- User experience should feel native and fast
