# QBox

QBox is a local data workspace application that helps you manage and explore data from multiple sources. Build your workspace by selecting tables from different PostgreSQL databases, view their metadata, and export documentation for AI-powered analysis.

## Features

- 📊 **Workspace-Based Data Management**: Select and organize tables from multiple data sources in one workspace
- 🐘 **PostgreSQL Support**: Connect to multiple PostgreSQL databases simultaneously
- 🦆 **DuckDB Query Engine**: Fast, embedded analytical database for cross-source queries
- 🗂️ **Metadata Management**: Automatic schema discovery and metadata collection
- 📥 **Metadata Export**: Export workspace metadata as markdown for AI model consumption
- � **Persistent Workspaces**: Your table selections are saved and restored across sessions
- 🌐 **Modern Web Interface**: Clean, dark-themed UI built with React and TypeScript
- 🔌 **Extensible Architecture**: Ready for future data sources (S3, CSV, Excel)

## Tech Stack

- **Backend**: Python 3.13+, FastAPI, DuckDB, SQLite
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Data Storage**: SQLite (connections and workspace persistence), DuckDB (query execution)
- **Package Management**: uv (Python), pnpm (Node.js)

## Prerequisites

- Python 3.13 or higher
- Node.js 18 or higher
- [uv](https://github.com/astral-sh/uv) - Fast Python package installer
- [pnpm](https://pnpm.io/) - Fast Node.js package manager
- PostgreSQL database(s) to connect to

## Quick Start

### 1. Install Dependencies

Install uv (if not already installed):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Install pnpm (if not already installed):
```bash
npm install -g pnpm
```

### 2. Environment Setup

No environment variables are required for basic operation. The application stores connection information and workspace selections in local SQLite databases at `~/.qbox/`.

### 3. Install Backend Dependencies

```bash
cd backend
uv pip install -e .
```

### 4. Install Frontend Dependencies

```bash
cd frontend
pnpm install
```

### 5. Run the Application

Start the backend server (from the `backend` directory):
```bash
uvicorn app.main:app --reload --port 8080
```

In a new terminal, start the frontend dev server (from the `frontend` directory):
```bash
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/docs

## How to Use

### 1. Create a Connection

1. Navigate to the **Connections** page using the sidebar
2. Click **Create New Connection**
3. Fill in your PostgreSQL connection details:
   - Connection Name (e.g., "Production DB")
   - Host, Port, Database
   - Username and Password
   - Schema (default: "public")
4. Click **Create Connection**

### 2. Add Connection to Workspace

1. In the Connections list, click **Add to Workspace** for your connection
2. The app will load the connection's metadata and switch to the Workspace page

### 3. Select Tables

1. In the Workspace page, you'll see your connections in the left panel
2. Expand connections → schemas → tables
3. Check individual tables or entire schemas to add them to your workspace
4. Selected tables appear as expandable cards in the main area

### 4. View Table Metadata

1. Click on any table card to expand it
2. View columns, data types, nullable fields, and primary keys
3. See row counts and table descriptions when available

### 5. Export Metadata

1. Click the **Export Metadata** button at the top of the workspace
2. A markdown file will download with all metadata from your selected tables
3. Use this file as context for AI models or documentation

## Development

### Running in Development Mode

**VS Code (Recommended):**
1. Start frontend: Command Palette (`Cmd+Shift+P`) → `Tasks: Run Task` → "Start Frontend Dev Server"
2. Start backend with debugging: Press `F5` to launch "Python: FastAPI Backend"
3. Or run both without debug: `Tasks: Run Task` → "Start Both Servers (No Debug)"

**Terminal:**
```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8080

# Terminal 2 - Frontend
cd frontend
pnpm dev
```

### Adding Dependencies

**Python packages:**
```bash
# Edit backend/pyproject.toml, then:
cd backend
uv pip install -e .
```

**npm packages:**
```bash
cd frontend
pnpm add package-name
```

### Architecture

**Backend (`backend/app/`):**
- `api/` - FastAPI route handlers (thin layer)
- `services/` - Business logic (DuckDB manager, repositories, metadata collection)
- `models/` - Pydantic schemas
- `config/` - Application settings

**Frontend (`frontend/src/`):**
- `components/` - React components (ConnectionManager, WorkspaceSelector, WorkspaceView)
- `services/api.ts` - Backend API client
- `types/` - TypeScript definitions

**Key Concepts:**
- **Workspace**: Collection of selected tables from multiple data sources (persisted in SQLite)
- **DuckDB Manager**: Persistent instance that attaches to multiple PostgreSQL databases
- **Metadata**: Auto-collected schema info (tables, columns, types, constraints, stats)

### Troubleshooting

**Port already in use:**
```bash
lsof -ti:8080 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

**Module not found errors:**
```bash
cd backend && uv pip install -e .
cd frontend && pnpm install
```

## Data Storage

QBox stores data locally in `~/.qbox/`:
- `connections.db` - SQLite database with connection configs and workspace selections
- `qbox.duckdb` - Persistent DuckDB instance with attached data sources

## Roadmap

**Completed:**
- ✅ PostgreSQL connection management
- ✅ Multi-connection workspace support
- ✅ Automatic metadata discovery
- ✅ Workspace persistence
- ✅ Metadata export

**Planned:**
- [ ] Query execution interface
- [ ] CSV file support
- [ ] Excel file support
- [ ] S3 bucket support
- [ ] AI-powered SQL generation
- [ ] Query history
- [ ] Result export and visualization
- [ ] Electron desktop application packaging

## License

MIT
