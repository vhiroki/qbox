#!/bin/bash

# QBox Backend Server - For Electron development
# This starts the FastAPI backend that the Electron app connects to

echo "🚀 Starting QBox Backend..."
echo ""

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found"
    echo "   Are you running this from the project root?"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "backend/.venv" ]; then
    echo "❌ Backend virtual environment not found!"
    echo ""
    echo "Please run setup first:"
    echo "  ./setup.sh"
    echo ""
    exit 1
fi

# Function to kill background process on exit
cleanup() {
    echo ""
    echo "👋 Shutting down backend..."
    kill $BACKEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Start backend
echo "Starting backend server on http://localhost:8080..."
cd backend
source .venv/bin/activate

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "❌ uvicorn not found in virtual environment"
    echo ""
    echo "Please run setup first:"
    echo "  ./setup.sh"
    echo ""
    exit 1
fi

# Single worker mode to avoid DuckDB concurrency issues
# DuckDB supports only one writer process at a time
uvicorn app.main:app --reload --port 8080 --workers 1 &
BACKEND_PID=$!
cd ..

echo ""
echo "✅ Backend is running!"
echo "   Backend API: http://localhost:8080"
echo "   API Docs: http://localhost:8080/docs"
echo ""
echo "💡 Use this with: cd frontend && npm run electron:dev"
echo ""
echo "Press Ctrl+C to stop"

# Wait for process
wait

