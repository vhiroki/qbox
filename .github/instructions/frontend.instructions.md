# Frontend Instructions (React + TypeScript + Electron)

applyTo: frontend/**

## Code Style Standards

- Functional components with hooks only (no classes)
- Strict TypeScript mode
- No `any` type - use proper types or `unknown`
- Explicit types for all props and state
- Async/await for API calls
- Try/catch with user-friendly error messages
- Export types separately from components
- Electron main process uses Node.js APIs (child_process, fs, path)
- Renderer process communicates via REST API only (no direct IPC needed currently)

## Linting

```bash
cd frontend
npm run lint                          # Run ESLint
```

## Architecture

**Components (`frontend/src/components/`):**
- `QueryList.tsx` - Left panel: list of queries
- `QueryDetail.tsx` - Right panel: query details with tabs
- `ChatInterface.tsx` - AI chat for SQL editing
- `ConnectionsTreeView.tsx` - Tree view for connections/schemas/tables
- `DataSourcesPanel.tsx` - Container for all data sources (connections, files, S3)
- `S3TreeView.tsx` - Tree view for S3 buckets
- `ConnectionManager.tsx` - Connection CRUD interface
- `ui/` - shadcn/ui base components

**Stores (`frontend/src/stores/`)** - Zustand state management:
- `useQueryStore.ts` - Query state and operations
- `useConnectionStore.ts` - Connection state and metadata cache (5-minute TTL)
- `useUIStore.ts` - UI state (modals, toasts, loading)

**Services (`frontend/src/services/api.ts`)** - Backend API client (Axios)

**Types (`frontend/src/types/`)** - TypeScript type definitions

**Electron (`frontend/electron/`):**
- `main.ts` - Main process (manages window, spawns backend, handles lifecycle)
- `preload.ts` - Preload script (secure IPC bridge)
- `config.ts` - Electron configuration (ports, paths, auto-update)

**Config Files:**
- `forge.config.ts` - Electron Forge build configuration
- `vite.config.ts` - Vite bundler configuration

## Prefer

✅ Async/await for API calls
✅ Explicit types for props and state
✅ Functional React components with hooks
✅ TailwindCSS utilities over custom CSS
✅ shadcn/ui components
✅ Zustand stores for shared state
✅ Electron-first development (use `run-backend.sh` + `npm run electron:dev`)
✅ Granular selectors to prevent unnecessary re-renders

## Avoid

❌ Class components
❌ `any` type - use proper types or `unknown`
❌ Global state (use Zustand stores)
❌ Browser-specific code (won't work in Electron)
❌ Direct DOM manipulation
❌ Dark/light theme toggles (dark theme only)
❌ Custom CSS when TailwindCSS utilities exist

## Error Handling

- Try/catch around all async operations
- Display user-friendly error messages via toast notifications
- Show loading states during operations
- Validate user input before API calls

## State Management (Zustand)

- `useQueryStore`: Manages queries, selections, chat history
- `useConnectionStore`: Manages connections, caches metadata (5-minute TTL)
- `useUIStore`: Manages modals, toasts, loading states
- Use granular selectors to prevent unnecessary re-renders
- Redux DevTools integration available for debugging

## Metadata Caching

- Frontend stores metadata in `useConnectionStore` with 5-minute TTL
- Backend collects metadata on-demand using DuckDB system functions
- Metadata includes: schemas, tables, columns, types, nullable, primary keys, row counts

## Performance

- Debounce user input in search/filter fields
- Use granular selectors in Zustand stores
- Limit query result sizes

## Extensible Data Sources

The `source_type` field in `query_selections` supports multiple data source types:
- **'connection'**: PostgreSQL databases
- **'file'**: CSV/Excel files
- **'s3'**: S3 buckets

When adding tables to a query, the UI shows all data sources in a unified tree view with filtering and real-time selection.
