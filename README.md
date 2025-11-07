# QBox

QBox is a local AI-powered data query application that allows you to query and work with data from multiple sources using natural language prompts.

## Features

- 🤖 AI-powered natural language to SQL conversion
- 🐘 PostgreSQL database connection (MVP)
- 🦆 DuckDB as the query engine
- 🌐 Modern web interface (React + TypeScript)
- 🚀 Fast and local execution
- 🔌 Extensible architecture for future data sources (S3, CSV, Excel)

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, DuckDB
- **Frontend**: React, TypeScript, Vite
- **AI**: OpenAI (extensible for other providers)
- **Package Management**: uv (Python), pnpm (Node.js)

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- [uv](https://github.com/astral-sh/uv) - Fast Python package installer
- [pnpm](https://pnpm.io/) - Fast Node.js package manager

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

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

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

## Development

### Backend Development

The backend is organized as follows:
```
backend/
├── app/
│   ├── main.py           # FastAPI application entry point
│   ├── api/              # API routes
│   ├── services/         # Business logic
│   ├── models/           # Data models
│   └── config/           # Configuration
```

### Frontend Development

The frontend is organized as follows:
```
frontend/
├── src/
│   ├── components/       # React components
│   ├── services/         # API client
│   ├── types/            # TypeScript types
│   └── App.tsx           # Main application
```

## Project Structure

```
qbox/
├── backend/              # Python FastAPI backend
├── frontend/             # React TypeScript frontend
├── .env                  # Environment variables
├── .gitignore
└── README.md
```

## Roadmap

- [x] PostgreSQL support (MVP)
- [ ] CSV file support
- [ ] Excel file support
- [ ] S3 bucket support
- [ ] Multiple AI provider support
- [ ] Query history
- [ ] Result export
- [ ] Data visualization

## License

MIT
