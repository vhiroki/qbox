#!/bin/bash
# Generate update YAML files for electron-updater
# Run this after building with: ./scripts/generate-update-yml.sh

set -e

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
PACKAGE_JSON="$FRONTEND_DIR/package.json"
OUT_DIR="$FRONTEND_DIR/out/make"

# Get version from package.json
VERSION=$(grep '"version"' "$PACKAGE_JSON" | sed 's/.*: "\(.*\)".*/\1/')
echo "Generating update files for version: $VERSION"

# Get current date in ISO format
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# macOS (ZIP - required for auto-updates)
MAC_ZIP="$OUT_DIR/zip/darwin/universal/QBox-darwin-universal-$VERSION.zip"
if [ -f "$MAC_ZIP" ]; then
    MAC_SIZE=$(stat -f%z "$MAC_ZIP" 2>/dev/null || stat -c%s "$MAC_ZIP" 2>/dev/null)
    MAC_SHA512=$(shasum -a 512 "$MAC_ZIP" | cut -d' ' -f1)
    MAC_FILENAME=$(basename "$MAC_ZIP")

    cat > "$OUT_DIR/latest-mac.yml" << EOF
version: $VERSION
files:
  - url: $MAC_FILENAME
    sha512: $MAC_SHA512
    size: $MAC_SIZE
path: $MAC_FILENAME
sha512: $MAC_SHA512
releaseDate: '$RELEASE_DATE'
EOF
    echo "✅ Generated $OUT_DIR/latest-mac.yml (points to ZIP for auto-updates)"
else
    # Fallback: try to find any ZIP file in the out/make directory
    MAC_ZIP=$(find "$OUT_DIR" -name "QBox-darwin-*.zip" 2>/dev/null | head -n 1)
    if [ -f "$MAC_ZIP" ]; then
        MAC_SIZE=$(stat -f%z "$MAC_ZIP" 2>/dev/null || stat -c%s "$MAC_ZIP" 2>/dev/null)
        MAC_SHA512=$(shasum -a 512 "$MAC_ZIP" | cut -d' ' -f1)
        MAC_FILENAME=$(basename "$MAC_ZIP")

        cat > "$OUT_DIR/latest-mac.yml" << EOF
version: $VERSION
files:
  - url: $MAC_FILENAME
    sha512: $MAC_SHA512
    size: $MAC_SIZE
path: $MAC_FILENAME
sha512: $MAC_SHA512
releaseDate: '$RELEASE_DATE'
EOF
        echo "✅ Generated $OUT_DIR/latest-mac.yml (points to ZIP for auto-updates)"
    else
        echo "⚠️  Warning: No ZIP file found for macOS auto-updates"
    fi
fi

# Windows (if Squirrel is enabled)
WIN_EXE=$(find "$OUT_DIR" -name "*.exe" 2>/dev/null | head -n 1)
if [ -f "$WIN_EXE" ]; then
    WIN_SIZE=$(stat -f%z "$WIN_EXE" 2>/dev/null || stat -c%s "$WIN_EXE" 2>/dev/null)
    WIN_SHA512=$(shasum -a 512 "$WIN_EXE" | cut -d' ' -f1)
    WIN_FILENAME=$(basename "$WIN_EXE")
    
    cat > "$OUT_DIR/latest.yml" << EOF
version: $VERSION
files:
  - url: $WIN_FILENAME
    sha512: $WIN_SHA512
    size: $WIN_SIZE
path: $WIN_FILENAME
sha512: $WIN_SHA512
releaseDate: '$RELEASE_DATE'
EOF
    echo "✅ Generated $OUT_DIR/latest.yml"
fi

# Linux (AppImage or deb)
LINUX_DEB=$(find "$OUT_DIR" -name "*.deb" 2>/dev/null | head -n 1)
if [ -f "$LINUX_DEB" ]; then
    LINUX_SIZE=$(stat -f%z "$LINUX_DEB" 2>/dev/null || stat -c%s "$LINUX_DEB" 2>/dev/null)
    LINUX_SHA512=$(shasum -a 512 "$LINUX_DEB" | cut -d' ' -f1)
    LINUX_FILENAME=$(basename "$LINUX_DEB")
    
    cat > "$OUT_DIR/latest-linux.yml" << EOF
version: $VERSION
files:
  - url: $LINUX_FILENAME
    sha512: $LINUX_SHA512
    size: $LINUX_SIZE
path: $LINUX_FILENAME
sha512: $LINUX_SHA512
releaseDate: '$RELEASE_DATE'
EOF
    echo "✅ Generated $OUT_DIR/latest-linux.yml"
fi

echo ""
echo "📦 Upload these files to your GitHub release:"
ls -la "$OUT_DIR"/*.yml 2>/dev/null || echo "No YML files generated"
echo ""
echo "⚠️  IMPORTANT for auto-updates:"
echo "  - Upload the ZIP files (not DMG) for macOS auto-updates"
echo "  - Upload the latest-mac.yml metadata file"
echo "  - DMG files are for manual installation only"

