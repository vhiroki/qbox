#!/bin/bash

# QBox Electron Setup Validation Script
# Checks that all prerequisites and files are in place for Electron builds

# Don't exit on errors - we want to show all issues
set +e

echo "🔍 QBox Electron Setup Validation"
echo "=================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo "ℹ $1"
}

section() {
    echo ""
    echo "--- $1 ---"
}

# Check Node.js
section "Node.js Environment"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js installed: $NODE_VERSION"
    
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        warning "Node.js version is older than 18. Consider upgrading."
    fi
else
    error "Node.js not found. Please install Node.js 18+"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    success "npm installed: $NPM_VERSION"
else
    error "npm not found"
fi

# Check Python
section "Python Environment"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    success "Python installed: $PYTHON_VERSION"
else
    error "Python 3 not found. Please install Python 3.11+"
fi

# Check backend virtual environment
if [ -d "$SCRIPT_DIR/backend/.venv" ]; then
    success "Backend virtual environment exists"
else
    warning "Backend virtual environment not found. Run: cd backend && python3 -m venv .venv"
fi

# Check frontend dependencies
section "Frontend Dependencies"
if [ -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    success "Frontend node_modules exists"
    
    # Check for key Electron packages
    if [ -d "$SCRIPT_DIR/frontend/node_modules/electron" ]; then
        success "Electron installed"
    else
        error "Electron not installed. Run: cd frontend && npm install"
    fi
    
    if [ -d "$SCRIPT_DIR/frontend/node_modules/@electron-forge/cli" ]; then
        success "Electron Forge installed"
    else
        error "Electron Forge not installed. Run: cd frontend && npm install"
    fi
    
    if [ -d "$SCRIPT_DIR/frontend/node_modules/electron-updater" ]; then
        success "electron-updater installed"
    else
        warning "electron-updater not installed. Auto-update won't work."
    fi
else
    error "Frontend node_modules not found. Run: cd frontend && npm install"
fi

# Check required files
section "Required Files"

REQUIRED_FILES=(
    "frontend/electron/main.ts"
    "frontend/electron/preload.ts"
    "frontend/electron/config.ts"
    "frontend/forge.config.ts"
    "frontend/vite.config.ts"
    "frontend/vite.main.config.ts"
    "frontend/vite.preload.config.ts"
    "frontend/package.json"
    "backend/build.py"
    "backend/build.spec"
    "build-electron.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        success "$file"
    else
        error "$file not found"
    fi
done

# Check for icons
section "Application Icons"
if [ -d "$SCRIPT_DIR/frontend/assets/icons" ]; then
    success "Icons directory exists"
    
    if [ -f "$SCRIPT_DIR/frontend/assets/icons/icon.icns" ]; then
        success "icon.icns found"
    else
        warning "icon.icns not found (macOS icon). Using default."
    fi
    
    if [ -f "$SCRIPT_DIR/frontend/assets/icons/icon.ico" ]; then
        success "icon.ico found"
    else
        warning "icon.ico not found (Windows icon). Using default."
    fi
    
    if [ -f "$SCRIPT_DIR/frontend/assets/icons/icon.png" ]; then
        success "icon.png found"
    else
        warning "icon.png not found (Linux icon). Using default."
    fi
else
    warning "Icons directory not found. Creating..."
    mkdir -p "$SCRIPT_DIR/frontend/assets/icons"
fi

# Check package.json scripts
section "Package.json Scripts"
if grep -q '"electron:dev"' "$SCRIPT_DIR/frontend/package.json"; then
    success "electron:dev script configured"
else
    error "electron:dev script missing in package.json"
fi

if grep -q '"electron:build"' "$SCRIPT_DIR/frontend/package.json"; then
    success "electron:build script configured"
else
    error "electron:build script missing in package.json"
fi

if grep -q '"electron:make"' "$SCRIPT_DIR/frontend/package.json"; then
    success "electron:make script configured"
else
    error "electron:make script missing in package.json"
fi

# Check for PyInstaller
section "Backend Build Tools"
if [ -d "$SCRIPT_DIR/backend/.venv" ]; then
    if [ -f "$SCRIPT_DIR/backend/.venv/bin/python" ]; then
        # Activate venv and check for PyInstaller
        source "$SCRIPT_DIR/backend/.venv/bin/activate"
        if python -c "import PyInstaller" 2>/dev/null; then
            success "PyInstaller installed in venv"
        else
            warning "PyInstaller not installed. Run: pip install pyinstaller"
        fi
        deactivate 2>/dev/null || true
    fi
else
    warning "Cannot check for PyInstaller (venv not found)"
fi

# Platform detection
section "Platform Information"
PLATFORM=$(uname -s)
case "$PLATFORM" in
    Darwin*)
        info "Platform: macOS"
        info "Can build: macOS (DMG)"
        ;;
    Linux*)
        info "Platform: Linux"
        info "Can build: Linux (DEB, RPM)"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        info "Platform: Windows"
        info "Can build: Windows (Squirrel)"
        ;;
    *)
        warning "Unknown platform: $PLATFORM"
        ;;
esac

# Summary
section "Summary"
echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    success "All checks passed! Your Electron setup is ready."
    echo ""
    echo "Next steps:"
    echo "  1. Run the app:  ./run-backend.sh (Terminal 1)"
    echo "                   cd frontend && npm run electron:dev (Terminal 2)"
    echo "  2. Build app:    ./build-electron.sh --make"
    echo ""
    echo "See README.md for complete documentation."
elif [ $ERRORS -eq 0 ]; then
    success "Setup is functional with $WARNINGS warnings."
    echo ""
    echo "You can proceed, but consider addressing the warnings above."
else
    error "Found $ERRORS errors and $WARNINGS warnings."
    echo ""
    echo "Please fix the errors before building the Electron app."
    exit 1
fi

echo ""

