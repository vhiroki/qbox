#!/bin/bash

# QBox Electron Development Setup Script

set -e

echo "🚀 QBox Electron Setup"
echo "======================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "✓ Found Python $PYTHON_VERSION"

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18 or later."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Found Node.js $NODE_VERSION"
echo ""

# Setup backend
echo "📦 Setting up backend..."
cd backend

# Check for .env file (optional - for custom backend settings)
if [ ! -f ".env" ]; then
    if [ -f "../.env.example" ]; then
        cp ../.env.example .env
        echo "✓ Created .env from example"
    fi
fi

# Check if uv is installed (required)
if ! command -v uv &> /dev/null; then
    echo "❌ uv not found. Please install uv first:"
    echo ""
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo ""
    echo "   Or visit: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

echo "Using uv for Python package management..."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    uv venv --python 3.13
fi

# Install Python dependencies (including dev/test dependencies)
echo "Installing Python dependencies..."
uv pip install -e ".[dev]"

# Install PyInstaller for building
echo "Installing PyInstaller..."
uv pip install pyinstaller

echo "✓ Backend setup complete"
cd ..

# Setup frontend
echo ""
echo "📦 Setting up frontend..."
cd frontend

# Check if pnpm is installed (preferred)
if command -v pnpm &> /dev/null; then
    echo "Using pnpm for Node package management..."
    pnpm install
elif command -v npm &> /dev/null; then
    echo "Using npm for Node package management..."
    npm install
else
    echo "❌ Neither npm nor pnpm found. Please install Node.js."
    exit 1
fi

echo "✓ Frontend setup complete"
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 To run the app:"
echo ""
echo "  Terminal 1: ./run-backend.sh"
echo "  Terminal 2: cd frontend && npm run electron:dev"
echo ""
echo "💡 First time? Configure your OpenAI API key in the app's Settings."
echo ""
echo "📖 See README.md for complete documentation."
echo ""
