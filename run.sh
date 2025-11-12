#!/bin/bash

# QBox Run Script - Starts both backend and frontend

echo "🚀 Starting QBox..."
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "👋 Shutting down QBox..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Start backend
echo "Starting backend server on http://localhost:8080..."
cd backend
source .venv/bin/activate
# Single worker mode to avoid DuckDB concurrency issues
# DuckDB supports only one writer process at a time
uvicorn app.main:app --reload --port 8080 --workers 1 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend server on http://localhost:5173..."
cd frontend
pnpm dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ QBox is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8080"
echo "   API Docs: http://localhost:8080/docs"
echo ""
echo "Press Ctrl+C to stop"

# Wait for processes
wait
