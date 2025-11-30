# QBox

AI-powered data query desktop application for building and managing SQL queries across multiple data sources.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Setup and Run](#setup-and-run)
  - [What setup.sh Does](#what-setupsh-does)
- [Building for Distribution](#building-for-distribution)
  - [Quick Build](#quick-build)
  - [Manual Build Steps](#manual-build-steps)
  - [Output](#output)
  - [Platform Notes](#platform-notes)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
  - [Database Connections](#database-connections)
  - [AI-Powered Query Building](#ai-powered-query-building)
  - [Data Sources](#data-sources)
  - [DuckDB Integration](#duckdb-integration)
  - [User Interface](#user-interface)
- [Data Storage](#data-storage)
- [Development](#development)
  - [Available Commands](#available-commands)
  - [Development Mode](#development-mode)
  - [Backend Development](#backend-development)
  - [Frontend Development](#frontend-development)
- [Configuration](#configuration)
  - [OpenAI API Key](#openai-api-key)
  - [Backend Environment (Optional)](#backend-environment-optional)
  - [Application Icons](#application-icons)
- [Auto-Updates](#auto-updates)
- [Building Production Apps](#building-production-apps)
  - [Code Signing (Recommended)](#code-signing-recommended)
  - [Distribution Checklist](#distribution-checklist)
- [Troubleshooting](#troubleshooting)
  - [Setup Issues](#setup-issues)
  - [Runtime Issues](#runtime-issues)
  - [Build Issues](#build-issues)
- [Performance](#performance)
- [Tech Stack Details](#tech-stack-details)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Desktop](#desktop)
- [Project Philosophy](#project-philosophy)
  - [Architecture Principles](#architecture-principles)
  - [Code Style](#code-style)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Overview

QBox is an Electron desktop application that lets you:
- Connect to PostgreSQL databases and browse schemas with full metadata
- Build SQL queries interactively with AI assistance via chat
- Execute queries across multiple data sources using DuckDB
- Manage data sources including databases, local files, and S3 buckets
- Track query history and iterate with AI-powered refinements

## Architecture

- **Desktop**: Electron with bundled Python backend
- **Frontend**: React 18 + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Python FastAPI + DuckDB + SQLite
- **AI**: OpenAI integration for interactive SQL building
- **Data**: DuckDB for analytics, SQLite for persistence

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm (or pnpm)
- **Python** 3.11+
- **macOS, Linux, or Windows**

### Setup and Run

```bash
# 1. One-time setup
./setup.sh

# 2. Start backend (Terminal 1)
./run-backend.sh

# 3. Start Electron app (Terminal 2)
cd frontend
npm run electron:dev
```

**First Launch**: Configure your OpenAI API key in Settings → it's saved securely in the local database.

That's it! The app opens in an Electron window with DevTools enabled for development.

### What `setup.sh` Does

- Creates Python virtual environment (uses `uv` if available, falls back to `pip`)
- Installs all backend dependencies (FastAPI, DuckDB, etc.)
- Installs PyInstaller for building distributables
- Installs frontend dependencies (uses `pnpm` if available, falls back to `npm`)
- Creates `.env` template if needed

## Building for Distribution

### Quick Build

```bash
# Build everything and create installers
./build-electron.sh --make
```

This builds the Python backend with PyInstaller, builds the React frontend with Vite, and creates platform-specific installers.

### Manual Build Steps

```bash
# 1. Build backend executable
cd backend
source .venv/bin/activate
python build.py

# 2. Build and package Electron app
cd ../frontend
npm run electron:make
```

### Output

Installers are created in `frontend/out/make/`:
- **macOS**: DMG installer (`*.dmg`)
- **Windows**: Squirrel installer (`Setup.exe`)
- **Linux**: DEB and RPM packages (`*.deb`, `*.rpm`)

Packaged apps (without installer) are in `frontend/out/qbox-{platform}-{arch}/`.

### Platform Notes

**Important**: Build on the target platform. PyInstaller doesn't support cross-compilation:
- **macOS**: Build on macOS (Intel or Apple Silicon)
- **Windows**: Build on Windows
- **Linux**: Build on Linux

## Project Structure

```
qbox/
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── api/             # API route handlers (thin HTTP layer)
│   │   ├── services/        # Business logic (core functionality)
│   │   ├── models/          # Pydantic schemas
│   │   └── config/          # Settings and configuration
│   ├── build.py             # PyInstaller build script
│   └── build.spec           # PyInstaller configuration
├── frontend/                 # React + Electron frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API client (api.ts)
│   │   ├── stores/          # Zustand state management
│   │   └── types/           # TypeScript definitions
│   ├── electron/
│   │   ├── main.ts          # Main Electron process
│   │   ├── preload.ts       # Preload script (secure IPC)
│   │   └── config.ts        # Electron configuration
│   ├── assets/icons/        # Application icons
│   ├── forge.config.ts      # Electron Forge configuration
│   └── vite.config.ts       # Vite build configuration
├── setup.sh                 # One-time development setup
├── run-backend.sh           # Start backend for development
├── build-electron.sh        # Build complete distributable
└── validate-electron-setup.sh  # Validate development setup
```

## Key Features

### Database Connections
- PostgreSQL connections with full schema introspection
- Real-time metadata caching (5-minute TTL)
- Browse tables, columns, types, and constraints
- Connection status monitoring
- Extensible architecture for additional database types

### AI-Powered Query Building
- Interactive chat interface for SQL generation
- Iterative query refinement with AI assistance
- Context-aware suggestions based on selected tables
- SQL history tracking per query
- Multi-table joins across different data sources

### Data Sources
- **PostgreSQL**: Full schema browsing and querying
- **Local Files**: CSV, Parquet, JSON
- **S3 Buckets**: Cloud storage integration
- **Extensible**: Architecture supports adding more source types

### DuckDB Integration
- In-process analytics engine
- Cross-source queries (join PostgreSQL with CSV, etc.)
- Persistent storage at `~/.qbox/qbox.duckdb`
- Single writer mode to avoid concurrency issues
- Connections attached with identifiers derived from connection names

### User Interface
- **Dark theme** design for comfortable use
- **Two-page structure**: Queries (main) and Connections (management)
- **Query Detail**: Tabs for SQL editing and table selection
- **Tree View**: Browse all data sources with metadata
- **Real-time filtering**: Search tables, show only selected
- **Desktop UX**: Keyboard shortcuts, native interactions

## Data Storage

QBox stores all data locally in `~/.qbox/`:
- **`qbox.duckdb`**: DuckDB database (query results, attached connections)
- **`connections.db`**: SQLite database (connections, queries, selections, chat history)

Schema:
- `connections`: Saved database connections
- `queries`: Query definitions with SQL text
- `query_selections`: Table selections per query
- `query_chat_history`: AI chat messages per query

## Development

### Available Commands

```bash
# Setup
./setup.sh                      # One-time setup (all dependencies)
./validate-electron-setup.sh    # Check setup status

# Development
./run-backend.sh                # Start backend server
npm run electron:dev            # Start Electron app (from frontend/)

# Building
./build-electron.sh             # Package app only
./build-electron.sh --make      # Create installers
python backend/build.py         # Build backend executable only
npm run electron:build          # Package Electron only (from frontend/)
npm run electron:make           # Create installers only (from frontend/)

# Frontend only
npm run build                   # Build React app
npm run lint                    # Run ESLint
```

### Development Mode

In development mode:
- Backend runs via `./run-backend.sh` with hot reload (`--reload` flag)
- Frontend loads from Vite dev server (http://localhost:5173)
- Backend API available at http://localhost:8080
- DevTools open by default for debugging
- Changes to React code hot reload automatically
- Changes to Python code trigger backend restart

### Backend Development

The backend uses:
- **FastAPI** for REST API
- **DuckDB** for query execution and analytics
- **SQLite** for persistent storage
- **Pydantic** for validation and serialization
- **Repository pattern** for data access
- **uvicorn** with single worker (DuckDB constraint)

Code style:
- PEP 8 compliant (Black + Ruff)
- Type hints required for all functions
- Async/await for I/O operations
- Small, single-purpose functions

### Frontend Development

The frontend uses:
- **React 18** functional components with hooks (no classes)
- **TypeScript** strict mode (no `any` types)
- **Zustand** for state management
- **TailwindCSS** + **shadcn/ui** for styling
- **Monaco Editor** for SQL editing

Component structure:
- Small, focused components
- Explicit TypeScript types for all props
- Try/catch with user-friendly error messages
- API calls through `services/api.ts`

## Configuration

### OpenAI API Key

Configure your OpenAI API key through the app:
1. Open the app
2. Go to Settings menu
3. Enter your OpenAI API key
4. Key is saved in `~/.qbox/connections.db`

No `.env` file needed for the API key - it's managed through the UI.

### Backend Environment (Optional)

Create `backend/.env` for custom backend settings:

```bash
# Optional backend configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
LOG_LEVEL=INFO
```

### Application Icons

Custom icons go in `frontend/assets/icons/`:
- `icon.icns` - macOS (512x512)
- `icon.ico` - Windows (256x256 with multiple sizes)
- `icon.png` - Linux (512x512)

Default Electron icons are used if custom icons aren't provided. See `frontend/assets/icons/README.md` for details.

## Auto-Updates

The app includes auto-update functionality (production builds only):
- Checks for updates on launch and every 6 hours
- Shows notification when update is available
- Downloads in background
- Prompts to restart when ready
- Configure update server in `frontend/electron/config.ts`

Default: Uses GitHub releases. Configure `UPDATE_SERVER_URL` environment variable for custom servers.

## Building Production Apps

### Code Signing (Recommended)

For distribution outside of your organization:

**macOS:**
- Requires Apple Developer account
- Code signing prevents "unidentified developer" warnings
- Notarization required for Gatekeeper
- Configure in `frontend/forge.config.ts` (`osxSign`, `osxNotarize`)

**Windows:**
- Code signing certificate from trusted CA
- Improves SmartScreen reputation
- Use `electron-builder` or `signtool`

### Distribution Checklist

Before distributing:
- [ ] Replace placeholder icons with your logo
- [ ] Update app metadata in `frontend/forge.config.ts`
- [ ] Configure code signing (macOS/Windows)
- [ ] Set up auto-update server or GitHub releases
- [ ] Test on all target platforms
- [ ] Test auto-update flow
- [ ] Create installers with `./build-electron.sh --make`
- [ ] Test installers on clean systems
- [ ] Add license file if needed

## Troubleshooting

### Setup Issues

**Virtual environment not found:**
```bash
./setup.sh  # Run setup script
```

**Dependencies missing:**
```bash
cd backend
source .venv/bin/activate
pip install -e .
pip install pyinstaller
```

**Frontend dependencies missing:**
```bash
cd frontend
npm install
```

### Runtime Issues

**Backend won't start:**
- Check port 8080 is free: `lsof -ti:8080`
- Verify venv is activated: `which python` (should show `.venv`)
- Check logs in the terminal running `run-backend.sh`
- Ensure all dependencies installed: `pip list`

**Electron won't start:**
- Ensure backend is running: `curl http://localhost:8080/health`
- Check DevTools console (View → Toggle Developer Tools)
- Verify frontend dependencies: `cd frontend && npm install`
- Run validation: `./validate-electron-setup.sh`

**Backend health check timeout:**
- Backend takes 5-10 seconds to start first time (DuckDB initialization)
- Check backend terminal for errors
- Increase timeout in `frontend/electron/config.ts` if needed

### Build Issues

**PyInstaller fails:**
- Ensure PyInstaller installed: `pip list | grep pyinstaller`
- Check for missing hidden imports in `backend/build.spec`
- Update PyInstaller: `pip install --upgrade pyinstaller`
- Some packages may not support all platforms

**Electron build fails:**
- Verify frontend builds: `cd frontend && npm run build`
- Check for TypeScript errors: `npm run lint`
- Clean and retry: `rm -rf frontend/out frontend/dist backend/dist`
- Ensure all dependencies installed: `npm install`

**DuckDB issues:**
- DuckDB files stored at `~/.qbox/qbox.duckdb`
- If corrupted, delete and restart app
- Ensure only one instance running (single instance lock enforced)
- DuckDB requires single writer (uvicorn runs with `--workers 1`)

## Performance

- **First launch**: 5-10 seconds (DuckDB initialization)
- **Subsequent launches**: 2-5 seconds
- **App size**: 150-250 MB (varies by platform, includes Python runtime)
- **Memory usage**: 200-400 MB (frontend + backend + Electron)
- **Metadata caching**: 5-minute TTL reduces redundant queries

## Tech Stack Details

### Backend
- Python 3.13+
- FastAPI for REST API
- DuckDB 0.9+ for analytics
- SQLite for persistence
- uvicorn with standard extras
- Pydantic for validation
- SQLAlchemy for database abstraction
- psycopg for PostgreSQL
- boto3 for S3 integration

### Frontend
- React 18
- TypeScript 5+
- Vite for bundling
- TailwindCSS 4 for styling
- shadcn/ui components
- Zustand for state management
- Monaco Editor for SQL
- Axios for HTTP

### Desktop
- Electron 39+
- Electron Forge for building
- electron-updater for auto-updates
- PyInstaller for backend bundling

## Project Philosophy

### Architecture Principles
- **Backend-driven state**: Minimize frontend state, persist in backend
- **Repository pattern**: Clean separation of data access
- **Type safety**: Full TypeScript and Python type hints
- **Electron-first**: Designed for desktop from the start
- **Cross-platform**: Works on macOS, Windows, Linux

### Code Style
- **Python**: PEP 8, Black formatting, Ruff linting, type hints required
- **TypeScript**: Strict mode, no `any`, explicit types
- **React**: Functional components with hooks only
- **API**: RESTful design, proper HTTP status codes
- **Error handling**: User-friendly messages, technical logs server-side

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test in development mode
5. Test the packaged app
6. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:
- Run `./validate-electron-setup.sh` to diagnose setup issues
- Check the troubleshooting section above
- Open an issue on GitHub

---

Built with ❤️ using Electron, React, Python, and DuckDB.
