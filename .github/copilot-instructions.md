# GitHub Copilot Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

QBox is an Electron desktop application for building and managing SQL queries across multiple data sources. It features PostgreSQL connections, AI-powered chat for SQL building, table selection with metadata, and query execution using DuckDB. The app runs locally with a bundled Python backend - no external servers required.

**Full documentation**: See [README.md](../README.md)

**Tech Stack:**
- **Desktop**: Electron 39+ with Electron Forge, auto-update support, bundled backend
- **Backend**: Python 3.11+, FastAPI, DuckDB, SQLite, uvicorn, uv
- **Frontend**: React 18, TypeScript 5+, Vite, TailwindCSS 4, shadcn/ui, Zustand
- **Build**: PyInstaller for backend bundling, Electron Forge for packaging
- **Platform**: macOS (Intel + Apple Silicon), Windows (x64), Linux (x64)

## Important Development Guidelines

**Build and Testing:**
- **DO NOT** attempt to build the backend or frontend after making changes
- The user will test all changes independently
- Focus on making code changes without running build commands

**Documentation Updates:**
- **ALWAYS** update relevant documentation when making major changes
- Keep documentation in sync with code changes to maintain accuracy

## Common Commands

### Development

**Electron App (Primary Workflow):**
```bash
# First time setup
./setup.sh

# Development
# Terminal 1: Backend
./run-backend.sh

# Terminal 2: Electron
cd frontend
npm run electron:dev
```

**Backend Only:**
```bash
cd backend
uv pip install -e .                    # Install dependencies
uvicorn app.main:app --reload --port 8080  # Run server
```

**Frontend:**
```bash
cd frontend
npm install                           # Install dependencies
npm run electron:dev                  # Start Electron app (dev mode)
npm run electron:build                # Package Electron app
npm run electron:make                 # Create installers
npm run build                         # Build React app only
npm run lint                          # Run linter
```

**Build Distribution:**
```bash
./build-electron.sh --make            # Build installers for all platforms
```

**Testing:**
```bash
cd backend
pytest                                # Run all tests (requires Docker for integration tests)
pytest tests/integration/             # Run integration tests only
pytest tests/test_specific.py         # Run specific test file
pytest -k test_name                   # Run tests matching pattern
pytest --cov=app --cov-report=term-missing  # Run with coverage
```

### Ports (Development Mode)

- Backend API: http://localhost:8080
- Frontend Dev Server: http://localhost:5173 (Electron loads from here in dev mode)
- API Docs: http://localhost:8080/docs

**Note**: In production, the Electron app bundles both frontend (built static files) and backend (PyInstaller executable). No web server needed.

### Troubleshooting

Kill processes on ports:
```bash
lsof -ti:8080 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

## Architecture Overview

### Backend Structure (Python + FastAPI)

**Key Directories:**
- `backend/app/api/` - Route handlers (thin layer, HTTP only)
- `backend/app/services/` - Business logic (thick layer)
- `backend/app/connections/` - Data source connection handlers
- `backend/app/models/schemas.py` - Pydantic models for validation
- `backend/app/config/settings.py` - Application settings

**Persistent Storage:**
- `~/.qbox/connections.db` - SQLite database (connections, queries, chat history, settings)
- `~/.qbox/qbox.duckdb` - Persistent DuckDB instance with attached data sources

### Frontend Structure (React + TypeScript + Electron)

**Key Directories:**
- `frontend/src/components/` - React components
- `frontend/src/stores/` - Zustand state management
- `frontend/src/services/api.ts` - Backend API client (Axios)
- `frontend/src/types/` - TypeScript type definitions
- `frontend/electron/` - Electron main process

### Core Architectural Patterns

**DuckDB Manager (Persistent Query Engine):**
- Single persistent instance at `~/.qbox/qbox.duckdb`
- **PostgreSQL**: Attaches databases with identifiers derived from connection names
- **S3**: Creates schema and secret for each connection
- **CSV/Excel files**: Registered as flat views without schema prefix
- Important: Identifiers use underscores (not hyphens) to avoid SQL identifier errors

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

**Query Architecture:**
- **Query**: Named SQL query with selected tables from one or multiple sources
- **Connection**: Saved PostgreSQL connection configuration
- **Data Source Types**: 'connection' (PostgreSQL), 'file' (CSV/Excel), 's3' (S3 buckets)
- **Chat History**: User-AI conversation stored per query for iterative SQL editing
- **SQL History**: Last 50 SQL versions per query for version tracking

## Electron Desktop Architecture

**Development Mode:**
- Backend runs separately via `./run-backend.sh` (for hot reload)
- Frontend loads from Vite dev server (http://localhost:5173)
- Electron window opened via `npm run electron:dev`
- DevTools enabled by default

**Production Mode:**
- Backend bundled as standalone executable with PyInstaller
- Frontend built as static files with Vite
- Electron spawns backend as child process on startup
- Health check ensures backend is ready before showing UI
- Single instance lock prevents multiple app instances

**Key Design Principles:**
- Backend and frontend communicate only via REST API (localhost:8080)
- Use localhost URLs (avoid hardcoded IPs)
- Cross-platform file paths (works on macOS, Windows, Linux)
- Avoid browser-specific APIs (must work in Electron renderer)
- State persists in backend SQLite database
- Backend lifecycle managed by Electron main process
- Auto-update support via electron-updater
