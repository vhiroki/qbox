# QBox Application Icons

This directory contains application icons for different platforms.

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

## TODO

Currently, this directory contains only placeholder documentation.
You need to add your actual application icons:

1. Create or design your QBox logo (512x512 PNG recommended)
2. Convert to platform-specific formats
3. Place the icons in this directory with the exact names specified above
4. The build process will automatically include them in the packaged app

## Temporary Workaround

If you want to build the app without custom icons:
1. You can use Electron's default icon (no files needed)
2. Or create simple colored squares as placeholders:
   ```bash
   # Create a simple placeholder
   convert -size 512x512 xc:blue icon.png
   ```

The Electron build will still work without icons, but your app will use default system icons.

