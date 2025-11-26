#!/bin/bash

# QBox Electron Build Script
# Orchestrates building both backend and frontend for Electron distribution

set -e  # Exit on error

echo "🚀 Building QBox Electron App..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Platform detection
PLATFORM=$(uname -s)
case "$PLATFORM" in
    Darwin*)
        PLATFORM_NAME="macOS"
        BACKEND_EXEC="qbox-backend"
        ;;
    Linux*)
        PLATFORM_NAME="Linux"
        BACKEND_EXEC="qbox-backend"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM_NAME="Windows"
        BACKEND_EXEC="qbox-backend.exe"
        ;;
    *)
        echo "❌ Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

echo "📦 Building for: $PLATFORM_NAME"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "✓ Python version: $PYTHON_VERSION"

# Check if Node/npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node version: $NODE_VERSION"
echo ""

# Step 1: Build Python backend
echo "🔨 Step 1/4: Building Python backend..."
cd "$BACKEND_DIR"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install/upgrade PyInstaller if needed
if ! python -c "import PyInstaller" &> /dev/null; then
    echo "📦 Installing PyInstaller..."
    pip install pyinstaller
fi

# Build backend
echo "🔨 Running PyInstaller..."
python build.py

# Verify backend was built
if [ ! -f "dist/$BACKEND_EXEC" ]; then
    echo "❌ Backend build failed - executable not found at dist/$BACKEND_EXEC"
    exit 1
fi

echo "✅ Backend built successfully"
echo ""

# Step 2: Copy backend to frontend resources
echo "📋 Step 2/4: Copying backend to Electron resources..."
BACKEND_RESOURCES_DIR="$FRONTEND_DIR/../backend/dist"
mkdir -p "$BACKEND_RESOURCES_DIR"

# The backend dist is already in the right place, just verify it
if [ -f "$BACKEND_DIR/dist/$BACKEND_EXEC" ]; then
    echo "✓ Backend executable ready at: $BACKEND_DIR/dist/$BACKEND_EXEC"
else
    echo "❌ Backend executable not found"
    exit 1
fi

echo ""

# Step 3: Build frontend
echo "🔨 Step 3/4: Building frontend..."
cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Build the frontend
echo "🔨 Building React app with Vite..."
npm run build

echo "✅ Frontend built successfully"
echo ""

# Step 4: Package with Electron Forge
echo "📦 Step 4/4: Creating Electron distributables..."
cd "$FRONTEND_DIR"

# Choose what to build based on platform
if [ "$1" == "--make" ]; then
    echo "🔨 Creating installers..."
    npm run make
else
    echo "🔨 Packaging app..."
    npm run package
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Output location:"
if [ "$1" == "--make" ]; then
    echo "   Installers: $FRONTEND_DIR/out/make/"
else
    echo "   Packaged app: $FRONTEND_DIR/out/"
fi
echo ""
echo "To create installers, run: ./build-electron.sh --make"
echo ""

