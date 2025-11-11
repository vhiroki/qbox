# QBox

QBox is a local data query application that helps you build and manage SQL queries across multiple data sources. Create queries, connect to PostgreSQL databases, select tables to work with, and use AI-powered chat to interactively build your SQL.

## Features

- 💬 **AI-Powered Query Building**: Chat with AI to iteratively build and refine SQL queries
- 📊 **Query Management**: Create and manage multiple queries for different analysis tasks
- 🐘 **PostgreSQL Support**: Connect to multiple PostgreSQL databases simultaneously
- 🦆 **DuckDB Query Engine**: Fast, embedded analytical database for cross-source queries
- 🗂️ **Metadata Management**: Automatic schema discovery and metadata collection
- 💾 **Persistent Queries**: Your queries, table selections, and chat history are saved across sessions
- 🌐 **Modern Web Interface**: Clean, dark-themed UI built with React and TypeScript
- 🔌 **Extensible Architecture**: Ready for future data sources (S3, CSV, Excel)

## Tech Stack

- **Backend**: Python 3.13+, FastAPI, DuckDB, SQLite
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Zustand
- **Data Storage**: SQLite (connections and query persistence), DuckDB (query execution)
- **State Management**: Zustand (centralized frontend state)
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

No environment variables are required for basic operation. The application stores connection information and query data in local SQLite databases at `~/.qbox/`.

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

### 1. Create a Query

1. On the **Queries** page (default view), click **Create Query**
2. Enter a name for your query (e.g., "Sales Analysis")
3. Click **Create**
4. Your new query appears in the left panel

### 2. Create a Connection

1. Navigate to the **Connections** page using the top navigation
2. Click **Create New Connection**
3. Fill in your PostgreSQL connection details:
   - Connection Name (e.g., "Production DB")
   - Host, Port, Database
   - Username and Password
   - Schema (default: "public")
4. Click **Create Connection**

### 3. Add Tables to a Query

1. Go back to the **Queries** page and select your query
2. Click **Add Tables** in the query detail area
3. Select a connection from the list
4. Choose a schema from the connection
5. Select the tables you want to add (use checkboxes)
6. Click **Add Selected Tables**

### 4. Build SQL with AI Chat

1. In the query detail area, you'll see the "Chat & SQL" tab
2. The SQL editor shows your current query (initially empty)
3. Type a message to the AI like "Write a SELECT query to get all active users"
4. The AI will generate SQL and update the editor
5. Continue chatting to refine: "Add a WHERE clause for created_at > '2024-01-01'"
6. Each message iteratively improves the SQL based on your Tables

### 5. View Table Metadata

1. Switch to the "Tables" tab
2. Click on any table card to view detailed metadata:
   - Column names and data types
   - Nullable fields
   - Primary keys
   - Row count

### 6. Manage Queries

- **Switch Queries**: Click on any query in the left panel
- **Edit SQL Directly**: You can manually edit the SQL in the editor
- **Clear Chat**: Remove chat history while keeping the SQL
- **Delete Tables**: Click the X button on a table card to remove it from the query
- **Delete Query**: Click the trash icon in the query header (removes query, selections, and chat history)

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
- `api/` - FastAPI route handlers (connections, queries, metadata)
- `services/` - Business logic (DuckDB manager, repositories, metadata collection, AI service)
- `models/` - Pydantic schemas
- `config/` - Application settings

**Frontend (`frontend/src/`):**
- `components/` - React components
  - `QueryList.tsx` - Left panel: list of all queries
  - `QueryDetail.tsx` - Right panel: query details with chat interface and table cards
  - `ChatInterface.tsx` - AI chat for interactive SQL editing
  - `AddTablesModal.tsx` - Multi-step modal for adding tables
  - `ConnectionManager.tsx` - Connection CRUD interface
- `stores/` - Zustand state management stores
  - `useQueryStore.ts` - Query state and operations
  - `useConnectionStore.ts` - Connection state and metadata cache
  - `useUIStore.ts` - UI state (modals, toasts, loading)
- `services/api.ts` - Backend API client
- `types/` - TypeScript definitions

**Key Concepts:**
- **Query**: A named SQL query with Tables (can include tables from multiple connections)
- **Connection**: Saved database configuration (PostgreSQL)
- **Chat History**: Conversational context for iterative SQL editing with AI
- **DuckDB Manager**: Persistent instance that attaches to multiple PostgreSQL databases
- **Metadata**: Auto-collected schema info (tables, columns, types, constraints, row counts)
- **State Management**: Zustand stores provide centralized state with automatic reactivity and Redux DevTools integration

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
- `connections.db` - SQLite database with connection configs, queries, query table selections, and chat history
- `qbox.duckdb` - Persistent DuckDB instance with attached data sources

## Roadmap

**Completed:**
- ✅ PostgreSQL connection management
- ✅ Query management (create, list, delete)
- ✅ Add tables to queries from any connection
- ✅ AI-powered chat interface for interactive SQL editing
- ✅ Chat history persistence per query
- ✅ Automatic metadata discovery
- ✅ Query and table selection persistence
- ✅ View detailed table metadata

**Planned:**
- [ ] Query execution interface
- [ ] Query result visualization
- [ ] Metadata export (markdown format)
- [ ] CSV file support
- [ ] Excel file support
- [ ] S3 bucket support
- [ ] Result export and visualization
- [ ] Electron desktop application packaging

## License

MIT
