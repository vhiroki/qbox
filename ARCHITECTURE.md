# QBox - Project Architecture

## Overview
QBox is an AI-powered data query application that allows users to connect to various data sources and query them using natural language. The MVP focuses on PostgreSQL support with DuckDB as the query engine.

## Architecture

### Backend (Python + FastAPI)
```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── api/                 # API route handlers
│   │   ├── connections.py   # Connection management endpoints
│   │   └── queries.py       # Query execution endpoints
│   ├── services/            # Business logic layer
│   │   ├── database.py      # Database connection management & DuckDB integration
│   │   └── ai.py           # AI service for SQL generation
│   ├── models/              # Data models
│   │   └── schemas.py       # Pydantic models
│   └── config/              # Configuration
│       └── settings.py      # Application settings
└── pyproject.toml           # Python dependencies (uv)
```

### Frontend (React + TypeScript)
```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── ConnectionForm.tsx   # Database connection form
│   │   └── AIQuery.tsx          # AI query interface
│   ├── services/            # API client
│   │   └── api.ts          # Axios-based API client
│   ├── types/              # TypeScript types
│   │   └── index.ts        # Shared type definitions
│   ├── App.tsx             # Main application component
│   ├── App.css             # Global styles
│   └── main.tsx            # Application entry point
├── index.html              # HTML template
├── package.json            # Node dependencies (pnpm)
└── vite.config.ts          # Vite configuration
```

## Key Features

### 1. Database Connections
- **PostgreSQL Support**: Connect to PostgreSQL databases via DuckDB's postgres extension
- **Connection Management**: Create, list, and delete connections
- **Schema Discovery**: Automatically fetch table and column information

### 2. AI-Powered Querying
- **Natural Language to SQL**: Convert user prompts to SQL queries using OpenAI
- **Context-Aware**: Uses database schema for accurate query generation
- **Generate & Execute**: Option to generate SQL only or execute immediately

### 3. Extensible Design
- **Provider Abstraction**: AI service layer supports multiple AI providers
- **Data Source Abstraction**: Easy to add new data sources (S3, CSV, Excel)
- **Type Safety**: Full TypeScript support on frontend, Pydantic validation on backend

## API Endpoints

### Connections
- `POST /api/connections/` - Create a new connection
- `GET /api/connections/` - List all connections
- `DELETE /api/connections/{id}` - Remove a connection
- `GET /api/connections/{id}/schema` - Get database schema

### Queries
- `POST /api/queries/execute` - Execute a SQL query
- `POST /api/queries/ai-generate` - Generate SQL from natural language

## Data Flow

1. **Connection Setup**:
   - User provides database credentials
   - Backend creates DuckDB instance and attaches PostgreSQL database
   - Connection stored in memory with unique ID

2. **AI Query**:
   - User enters natural language prompt
   - Backend fetches database schema
   - OpenAI generates SQL query based on schema and prompt
   - Optionally executes query and returns results

3. **Direct Query**:
   - User writes SQL directly
   - Backend executes via DuckDB
   - Results returned as JSON

## Technology Stack

### Backend
- **FastAPI**: Modern, fast web framework
- **DuckDB**: Embedded analytical database with PostgreSQL connector
- **OpenAI**: GPT-4 for natural language to SQL conversion
- **Pydantic**: Data validation and settings management
- **uvicorn**: ASGI server

### Frontend
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client for API calls

### Development Tools
- **uv**: Fast Python package installer
- **pnpm**: Efficient Node.js package manager
- **Black/Ruff**: Python code formatting and linting
- **ESLint**: JavaScript/TypeScript linting

## Future Enhancements

### Phase 2: Additional Data Sources
- CSV file support
- Excel file support
- S3 bucket integration

### Phase 3: Advanced Features
- Query history and saved queries
- Data visualization (charts, graphs)
- Result export (CSV, JSON, Excel)
- Multi-table joins with visual query builder
- Query optimization suggestions

### Phase 4: Multi-Model AI
- Support for Claude, local models (Ollama)
- Model selection in UI
- Comparison mode (generate with multiple models)

### Phase 5: Collaboration
- Shared connections and queries
- User authentication
- Query templates and snippets
- Team workspaces

## Security Considerations

- Credentials stored in memory only (not persisted)
- Environment variables for API keys
- CORS configuration for development
- Consider encryption for production deployment
- Rate limiting for AI API calls
- SQL injection prevention via parameterized queries

## Development Workflow

1. **Setup**: Run `./setup.sh` to install dependencies
2. **Development**: Run `./run.sh` to start both servers
3. **Backend**: Runs on http://localhost:8080 with auto-reload
4. **Frontend**: Runs on http://localhost:5173 with hot module replacement
5. **API Docs**: FastAPI automatically generates docs at http://localhost:8080/docs
