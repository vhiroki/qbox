#!/bin/bash

# QBox Development Setup and Run Script

set -e

echo "🚀 QBox Development Setup"
echo "=========================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it and add your OPENAI_API_KEY"
    echo ""
    read -p "Press enter to continue after you've added your API key..."
fi

# Setup backend
echo "📦 Setting up backend..."
cd backend

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Installing..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    uv venv
fi

# Install Python dependencies
echo "Installing Python dependencies..."
uv pip install -e .

cd ..

# Setup frontend
echo "📦 Setting up frontend..."
cd frontend

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing..."
    npm install -g pnpm
fi

# Install Node dependencies
echo "Installing Node dependencies..."
pnpm install

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the application:"
echo "  1. Start the backend:  cd backend && uvicorn app.main:app --reload --port 8080"
echo "  2. Start the frontend: cd frontend && pnpm dev"
echo ""
echo "Or use the run script: ./run.sh"
