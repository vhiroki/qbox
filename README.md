# QBox

QBox is a local data workspace application that helps you manage and explore data from multiple sources. Create workspaces, connect to PostgreSQL databases, select tables to organize your data, and view comprehensive metadata.

## Features

- � **Multi-Workspace Management**: Create and manage multiple workspaces for different projects
- 🐘 **PostgreSQL Support**: Connect to multiple PostgreSQL databases simultaneously
- 🦆 **DuckDB Query Engine**: Fast, embedded analytical database for cross-source queries
- 🗂️ **Metadata Management**: Automatic schema discovery and metadata collection
- � **Persistent Workspaces**: Your workspaces and table selections are saved and restored across sessions
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

### 1. Create a Workspace

1. On the **Workspaces** page (default view), click **Create Workspace**
2. Enter a name for your workspace (e.g., "Analytics Project")
3. Click **Create**
4. Your new workspace appears in the left panel

### 2. Create a Connection

1. Navigate to the **Connections** page using the top navigation
2. Click **Create New Connection**
3. Fill in your PostgreSQL connection details:
   - Connection Name (e.g., "Production DB")
   - Host, Port, Database
   - Username and Password
   - Schema (default: "public")
4. Click **Create Connection**

### 3. Add Tables to a Workspace

1. Go back to the **Workspaces** page and select your workspace
2. Click **Add Tables** in the workspace detail area
3. Select a connection from the list
4. Choose a schema from the connection
5. Select the tables you want to add (use checkboxes)
6. Click **Add Selected Tables**

### 4. View Table Metadata

1. In the workspace detail area, you'll see all tables you've added
2. Each table is shown as a card with:
   - Connection name and schema
   - Table name
   - Column count and row count
3. Click on a table card to view detailed metadata:
   - Column names and data types
   - Nullable fields
   - Primary keys
   - Row count

### 5. Manage Workspaces

- **Switch Workspaces**: Click on any workspace in the left panel
- **Delete Tables**: Click the X button on a table card to remove it from the workspace
- **Delete Workspace**: Click the trash icon in the workspace header (removes workspace and all selections)

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
- `api/` - FastAPI route handlers (connections, workspace, metadata, queries)
- `services/` - Business logic (DuckDB manager, repositories, metadata collection)
- `models/` - Pydantic schemas
- `config/` - Application settings

**Frontend (`frontend/src/`):**
- `components/` - React components
  - `WorkspaceList.tsx` - Left panel: list of all workspaces
  - `WorkspaceDetail.tsx` - Right panel: workspace details and table cards
  - `AddTablesModal.tsx` - Multi-step modal for adding tables
  - `ConnectionManager.tsx` - Connection CRUD interface
- `services/api.ts` - Backend API client
- `types/` - TypeScript definitions

**Key Concepts:**
- **Workspace**: Named collection of selected tables (can include tables from multiple connections)
- **Connection**: Saved database configuration (PostgreSQL)
- **DuckDB Manager**: Persistent instance that attaches to multiple PostgreSQL databases
- **Metadata**: Auto-collected schema info (tables, columns, types, constraints, row counts)

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
- `connections.db` - SQLite database with connection configs, workspaces, and workspace table selections
- `qbox.duckdb` - Persistent DuckDB instance with attached data sources

## Roadmap

**Completed:**
- ✅ PostgreSQL connection management
- ✅ Multi-workspace support (create, list, delete)
- ✅ Add tables to workspaces from any connection
- ✅ Automatic metadata discovery
- ✅ Workspace and table selection persistence
- ✅ View detailed table metadata

**Planned:**
- [ ] Query execution interface
- [ ] Metadata export (markdown format)
- [ ] CSV file support
- [ ] Excel file support
- [ ] S3 bucket support
- [ ] AI-powered SQL generation
- [ ] Query history
- [ ] Result export and visualization
- [ ] Electron desktop application packaging

## License

MIT
