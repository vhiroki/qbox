# QBox Development Workflow Guide

## Quick Start

### Initial Setup

1. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

2. **Run the setup script**:
   ```bash
   ./setup.sh
   ```

## VS Code Development Workflow

### Recommended: Backend Debug + Frontend Dev Mode

This is the recommended workflow for active development:

#### Step 1: Start Frontend Dev Server

1. Open VS Code Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Type: `Tasks: Run Task`
3. Select: **"Start Frontend Dev Server"**
4. Frontend will start at http://localhost:5173 with hot reload

**OR** use the terminal:
```bash
cd frontend
pnpm dev
```

#### Step 2: Start Backend in Debug Mode

1. Open any Python file in the backend (e.g., `backend/app/main.py`)
2. Press `F5` or go to Run & Debug panel (`Cmd+Shift+D` / `Ctrl+Shift+D`)
3. Select: **"Python: FastAPI Backend"**
4. Click the green play button or press `F5`

**Features:**
- ✅ Set breakpoints in Python code
- ✅ Step through code execution
- ✅ Inspect variables
- ✅ Hot reload on file changes
- ✅ See logs in Debug Console

### Alternative: Run Both Without Debug

If you don't need debugging:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type: `Tasks: Run Task`
3. Select: **"Start Both Servers (No Debug)"**

This starts both backend and frontend in separate terminals.

## Debugging Tips

### Backend Debugging

**Setting Breakpoints:**
- Click in the left gutter of any Python file
- Red dot appears = breakpoint set
- Code execution will pause at breakpoints

**Debug Actions:**
- `F5` - Continue
- `F10` - Step Over
- `F11` - Step Into
- `Shift+F11` - Step Out
- `Cmd+Shift+F5` / `Ctrl+Shift+F5` - Restart
- `Shift+F5` - Stop

**Useful Debug Features:**
- **Variables Panel**: See all variables in current scope
- **Watch Panel**: Add expressions to monitor
- **Call Stack**: See function call hierarchy
- **Debug Console**: Execute Python expressions at runtime

**Example Debugging Session:**
1. Set breakpoint in `backend/app/services/ai.py` in `generate_sql()` method
2. Open frontend, enter a prompt
3. Click "Generate SQL"
4. Backend pauses at breakpoint
5. Inspect `prompt`, `schema`, etc.
6. Step through OpenAI API call
7. Continue execution

### Frontend Debugging

**Browser DevTools:**
- Frontend runs in browser, use browser DevTools
- Chrome: `Cmd+Option+I` / `Ctrl+Shift+I`
- React DevTools extension recommended

**Console Logging:**
```typescript
console.log('API Response:', result);
console.error('Error occurred:', error);
```

**Network Tab:**
- Monitor API calls to backend
- Check request/response payloads
- Verify status codes

## Development Tasks

### Install Dependencies

**Backend:**
```bash
cd backend
uv pip install -e .
```

**Frontend:**
```bash
cd frontend
pnpm install
```

**OR** use VS Code tasks:
- Command Palette → `Tasks: Run Task` → **"Install Backend Dependencies"**
- Command Palette → `Tasks: Run Task` → **"Install Frontend Dependencies"**

### Adding New Python Packages

1. Edit `backend/pyproject.toml`:
   ```toml
   dependencies = [
       "fastapi>=0.104.0",
       "your-new-package>=1.0.0",
   ]
   ```

2. Install:
   ```bash
   cd backend
   uv pip install -e .
   ```

### Adding New npm Packages

```bash
cd frontend
pnpm add package-name
# or for dev dependencies
pnpm add -D package-name
```

## Testing

### Backend Tests (Coming Soon)

```bash
cd backend
pytest
```

### Frontend Tests (Coming Soon)

```bash
cd frontend
pnpm test
```

## Code Formatting

### Python (Black)

- **Auto-format on save**: Enabled by default
- **Manual format**: `Shift+Option+F` / `Shift+Alt+F`
- **CLI**:
  ```bash
  cd backend
  black app/
  ```

### TypeScript/React

- **Auto-format on save**: Enabled by default
- **Manual format**: `Shift+Option+F` / `Shift+Alt+F`

## Linting

### Python (Ruff)

Errors appear in Problems panel automatically.

### TypeScript (ESLint)

Errors appear in Problems panel automatically.

## Environment Variables

All environment variables are in `.env` file at project root:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4

# Application Configuration
BACKEND_PORT=8080
FRONTEND_PORT=5173

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Important:** Never commit `.env` file (it's in `.gitignore`)

## Keyboard Shortcuts

### Debug
- `F5` - Start/Continue debugging
- `Shift+F5` - Stop debugging
- `Cmd+Shift+F5` / `Ctrl+Shift+F5` - Restart debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into

### General
- `Cmd+Shift+P` / `Ctrl+Shift+P` - Command Palette
- `Cmd+P` / `Ctrl+P` - Quick file open
- `Cmd+Shift+F` / `Ctrl+Shift+F` - Search in files
- `Cmd+B` / `Ctrl+B` - Toggle sidebar
- `Ctrl+\`` - Toggle terminal

### Terminal
- `Cmd+Shift+\`` / `Ctrl+Shift+\`` - Create new terminal
- `Cmd+K` / `Ctrl+K` - Clear terminal

## Recommended VS Code Extensions

The project includes extension recommendations (`.vscode/extensions.json`). VS Code will prompt you to install them:

### Essential
- **Python** - Python language support
- **Pylance** - Fast Python language server
- **Black Formatter** - Python code formatting
- **Ruff** - Fast Python linter
- **ESLint** - JavaScript/TypeScript linting

### Helpful
- **GitHub Copilot** - AI pair programmer
- **GitLens** - Enhanced Git features
- **Git Graph** - Visual commit history

## Common Issues & Solutions

### Backend won't start in debug mode

**Issue:** "Module not found" errors

**Solution:**
```bash
cd backend
uv pip install -e .
```

### Frontend build errors

**Issue:** TypeScript errors or missing modules

**Solution:**
```bash
cd frontend
pnpm install
```

### Port already in use

**Issue:** "Address already in use" on port 8080 or 5173

**Solution:**
```bash
# Find and kill process using port
lsof -ti:8080 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

### Environment variables not loading

**Issue:** Backend can't find OPENAI_API_KEY

**Solution:**
1. Ensure `.env` file exists in project root
2. Check `OPENAI_API_KEY=` is set
3. Restart debug session

### Python not found

**Issue:** VS Code can't find Python interpreter

**Solution:**
1. `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Type: "Python: Select Interpreter"
3. Choose: `./backend/.venv/bin/python`

## Project Structure Quick Reference

```
qbox/
├── .env                    # Environment variables (YOU CREATE THIS)
├── .vscode/               # VS Code configuration
│   ├── launch.json        # Debug configurations
│   ├── tasks.json         # Task definitions
│   ├── settings.json      # Workspace settings
│   └── extensions.json    # Recommended extensions
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app (START HERE for backend)
│   │   ├── api/          # Route handlers
│   │   ├── services/     # Business logic
│   │   ├── models/       # Data models
│   │   └── config/       # Configuration
│   └── pyproject.toml    # Python dependencies
└── frontend/
    ├── src/
    │   ├── App.tsx       # Main component (START HERE for frontend)
    │   ├── components/   # React components
    │   ├── services/     # API client
    │   └── types/        # TypeScript types
    └── package.json      # npm dependencies
```

## Daily Development Checklist

1. ✅ Pull latest changes: `git pull`
2. ✅ Start frontend: Command Palette → "Start Frontend Dev Server"
3. ✅ Start backend in debug: Press `F5`
4. ✅ Open browser: http://localhost:5173
5. ✅ Check backend API docs: http://localhost:8080/docs
6. ✅ Code, test, debug
7. ✅ Commit changes: `git commit -m "feat: your change"`
8. ✅ Push: `git push`

## Getting Help

- **Backend API docs**: http://localhost:8080/docs (when server is running)
- **FastAPI docs**: https://fastapi.tiangolo.com
- **React docs**: https://react.dev
- **DuckDB docs**: https://duckdb.org/docs

## Tips for Effective Development

1. **Use breakpoints liberally** - Don't just use print statements
2. **Check the Debug Console** - Backend logs appear here
3. **Monitor Network tab** - See all API requests/responses
4. **Hot reload is your friend** - Both servers auto-reload on changes
5. **Use GitHub Copilot** - Let AI help with boilerplate
6. **Commit often** - Small, focused commits are better
7. **Test as you go** - Don't wait until the end

Happy coding! 🚀
