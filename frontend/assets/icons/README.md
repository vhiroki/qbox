# QBox Application Icons

This directory contains application icons for different platforms.

## Table of Contents

- [Required Icons](#required-icons)
  - [macOS](#macos)
  - [Windows](#windows)
  - [Linux](#linux)
- [Creating Icons](#creating-icons)
  - [Option 1: Using ImageMagick](#option-1-using-imagemagick)
  - [Option 2: Online Tools](#option-2-online-tools)
  - [Option 3: Using macOS iconutil](#option-3-using-macos-iconutil)
- [Current Status](#current-status)
- [Updating Icons](#updating-icons)

## Required Icons

### macOS
- **icon.icns** - macOS application icon
  - Size: 512x512 pixels minimum
  - Format: ICNS (Apple Icon Image)
  - Tool to create: Use `iconutil` or online converters

### Windows
- **icon.ico** - Windows application icon
  - Sizes: 16x16, 32x32, 48x48, 256x256 pixels
  - Format: ICO (Windows Icon)
  - Tool to create: Use ImageMagick or online converters

### Linux
- **icon.png** - Linux application icon
  - Size: 512x512 pixels
  - Format: PNG

## Creating Icons

### Option 1: Using ImageMagick

```bash
# From a PNG source image (512x512)
convert icon.png -resize 512x512 icon.png
convert icon.png -resize 256x256 -define icon:auto-resize icon.ico
```

### Option 2: Online Tools

- https://cloudconvert.com/png-to-icns (PNG to ICNS)
- https://cloudconvert.com/png-to-ico (PNG to ICO)
- https://www.icoconverter.com/ (Generic icon converter)

### Option 3: Using macOS `iconutil`

```bash
# Create an iconset directory
mkdir icon.iconset
# Add various sizes (16x16@1x, 32x32@1x, etc.)
# Convert to ICNS
iconutil -c icns icon.iconset -o icon.icns
```

## Current Status

✅ **Icons are now configured!** This directory contains the QBox application icons in all required formats:

- `icon.icns` - macOS application icon (197 KB)
- `icon.ico` - Windows application icon (372 KB)
- `icon.png` - Linux application icon (512x512)
- Additional PNG sizes for various uses (16x16 to 1024x1024)

These icons are automatically included in the packaged Electron app for all platforms.

## Updating Icons

To update the application icons:

1. Create or update your source image (preferably 1024x1024 PNG)
2. Use the icon generation script:
   ```bash
   cd frontend
   npm run generate-icons
   ```
3. The script will automatically create all required formats and sizes

