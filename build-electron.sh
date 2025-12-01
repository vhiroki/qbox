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

# Code sign the backend executable on macOS (if signing identity is available)
if [ "$PLATFORM_NAME" == "macOS" ]; then
    # Check if we have a signing identity
    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"

    # If not in env var, try to find one in keychain
    if [ -z "$SIGNING_IDENTITY" ]; then
        SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -n 1 | grep -o '".*"' | tr -d '"' || echo "")
    fi

    if [ -n "$SIGNING_IDENTITY" ]; then
        echo "🔐 Code signing backend executable with: $SIGNING_IDENTITY"

        # Sign the backend with deep signing and hardened runtime
        codesign --force --deep \
            --options runtime \
            --entitlements "$BACKEND_DIR/entitlements.plist" \
            --sign "$SIGNING_IDENTITY" \
            --timestamp \
            "dist/$BACKEND_EXEC"

        # Verify the signature
        if codesign --verify --verbose "dist/$BACKEND_EXEC" 2>&1; then
            echo "✅ Backend signature verified"
        else
            echo "⚠️  Backend signature verification failed, but continuing..."
        fi
    else
        echo "⚠️  No code signing identity found - backend will not be signed"
        echo "   To sign the backend, set APPLE_SIGNING_IDENTITY environment variable"
        echo "   or ensure a 'Developer ID Application' certificate is in your keychain"
    fi
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

# Step 3: Build frontend (skip - Electron Forge will handle this)
echo "🔨 Step 3/4: Preparing frontend..."
cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "✅ Frontend dependencies ready"
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

# Generate update YAML files for auto-updater (only when making installers)
if [ "$1" == "--make" ]; then
    echo "📝 Generating auto-update metadata files..."
    if [ -f "$SCRIPT_DIR/scripts/generate-update-yml.sh" ]; then
        "$SCRIPT_DIR/scripts/generate-update-yml.sh"
    else
        echo "⚠️  generate-update-yml.sh not found, skipping auto-update metadata"
    fi
    echo ""
fi

echo "📦 Output location:"
if [ "$1" == "--make" ]; then
    echo "   Installers: $FRONTEND_DIR/out/make/"
    echo ""
    echo "📤 To release with auto-update support:"
    echo "   1. Create a GitHub release with tag v$(grep '"version"' "$FRONTEND_DIR/package.json" | sed 's/.*: "\(.*\)".*/\1/')"
    echo "   2. Upload all files from: $FRONTEND_DIR/out/make/"
    echo "   3. Include the .yml files for auto-update to work"
else
    echo "   Packaged app: $FRONTEND_DIR/out/"
fi
echo ""
echo "To create installers, run: ./build-electron.sh --make"
echo ""

