#!/usr/bin/env node
/**
 * QBox Icon Generator
 * 
 * Generates app icons for macOS, Windows, and Linux from the logo SVG.
 * Creates a dark gradient background with the amber logo on top.
 * 
 * Usage: node scripts/generate-icons.cjs
 * 
 * Prerequisites:
 *   npm install --save-dev sharp png-to-ico
 */

const sharp = require('sharp');
const { default: pngToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOGO_PATH = path.resolve(__dirname, '../../docs/logo.svg');
const ICONS_DIR = path.resolve(__dirname, '../assets/icons');

// Icon style configuration - using QBox color palette
const ICON_CONFIG = {
  // Logo padding (percentage of icon size)
  logoPadding: 0.15,
  // Corner radius (percentage of icon size) - for rounded square look
  cornerRadius: 0.22,
  // Gradient colors (from QBox palette)
  gradientStart: '#212121ff',  // Top - Tertiary BG (window headers)
  gradientEnd: '#14120b',    // Bottom - Primary BG (main background)
  // Optional: subtle amber glow behind logo
  glowEnabled: true,
  glowColor: 'rgba(245, 158, 11, 0.08)',
  glowRadius: 0.25, // percentage of icon size
};

// Sizes needed for iconset (macOS)
const ICONSET_SIZES = [
  { size: 16, suffix: '16x16' },
  { size: 32, suffix: '16x16@2x' },
  { size: 32, suffix: '32x32' },
  { size: 64, suffix: '32x32@2x' },
  { size: 128, suffix: '128x128' },
  { size: 256, suffix: '128x128@2x' },
  { size: 256, suffix: '256x256' },
  { size: 512, suffix: '256x256@2x' },
  { size: 512, suffix: '512x512' },
  { size: 1024, suffix: '512x512@2x' },
];

// Sizes needed for Windows ICO
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Creates an SVG gradient background with rounded corners
 */
function createGradientBackgroundSVG(size) {
  const radius = Math.round(size * ICON_CONFIG.cornerRadius);
  const glowRadius = Math.round(size * ICON_CONFIG.glowRadius);
  const centerX = size / 2;
  const centerY = size / 2;
  
  let glowElement = '';
  if (ICON_CONFIG.glowEnabled) {
    glowElement = `
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${ICON_CONFIG.glowColor}" />
          <stop offset="100%" stop-color="transparent" />
        </radialGradient>
      </defs>
      <circle cx="${centerX}" cy="${centerY}" r="${glowRadius}" fill="url(#glow)" />
    `;
  }
  
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${ICON_CONFIG.gradientStart}" />
          <stop offset="100%" stop-color="${ICON_CONFIG.gradientEnd}" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)" />
      ${glowElement}
    </svg>
  `;
}

/**
 * Generate a PNG icon with gradient background and logo
 */
async function generatePNG(svgPath, outputPath, size) {
  const padding = Math.round(size * ICON_CONFIG.logoPadding);
  const logoSize = size - (padding * 2);
  
  // Create gradient background
  const backgroundSVG = createGradientBackgroundSVG(size);
  const background = await sharp(Buffer.from(backgroundSVG))
    .png()
    .toBuffer();
  
  // Resize logo
  const logo = await sharp(svgPath)
    .resize(logoSize, logoSize, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 } 
    })
    .png()
    .toBuffer();
  
  // Composite logo on top of background
  await sharp(background)
    .composite([
      {
        input: logo,
        top: padding,
        left: padding,
      }
    ])
    .png()
    .toFile(outputPath);
}

async function generateMacOSIconset() {
  console.log('📦 Generating macOS iconset...');
  
  const iconsetPath = path.join(ICONS_DIR, 'icon.iconset');
  await ensureDir(iconsetPath);
  
  for (const { size, suffix } of ICONSET_SIZES) {
    const outputPath = path.join(iconsetPath, `icon_${suffix}.png`);
    await generatePNG(LOGO_PATH, outputPath, size);
    console.log(`   ✓ icon_${suffix}.png (${size}x${size})`);
  }
  
  // Use iconutil to create .icns (macOS only)
  if (process.platform === 'darwin') {
    console.log('   Converting to .icns...');
    const icnsPath = path.join(ICONS_DIR, 'icon.icns');
    try {
      execSync(`iconutil -c icns "${iconsetPath}" -o "${icnsPath}"`);
      console.log('   ✓ icon.icns created');
      
      // Clean up iconset folder
      fs.rmSync(iconsetPath, { recursive: true });
      console.log('   ✓ Cleaned up iconset folder');
    } catch (error) {
      console.log('   ⚠ Could not create .icns (iconutil failed)');
      console.log('   Keeping iconset folder for manual conversion');
    }
  } else {
    console.log('   ⚠ Skipping .icns creation (not on macOS)');
    console.log('   Use iconutil or an online converter to create icon.icns from the iconset');
  }
}

async function generateWindowsICO() {
  console.log('📦 Generating Windows ICO...');
  
  const tempDir = path.join(ICONS_DIR, 'temp-ico');
  await ensureDir(tempDir);
  
  const pngPaths = [];
  
  for (const size of ICO_SIZES) {
    const outputPath = path.join(tempDir, `icon-${size}.png`);
    await generatePNG(LOGO_PATH, outputPath, size);
    pngPaths.push(outputPath);
    console.log(`   ✓ icon-${size}.png`);
  }
  
  // Create ICO from PNGs
  console.log('   Converting to .ico...');
  const icoPath = path.join(ICONS_DIR, 'icon.ico');
  
  try {
    const icoBuffer = await pngToIco(pngPaths);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('   ✓ icon.ico created');
  } catch (error) {
    console.log('   ⚠ Could not create .ico:', error.message);
  }
  
  // Clean up temp PNGs
  fs.rmSync(tempDir, { recursive: true });
  console.log('   ✓ Cleaned up temp files');
}

async function generateLinuxPNG() {
  console.log('📦 Generating Linux PNG...');
  
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  
  for (const size of sizes) {
    const outputPath = path.join(ICONS_DIR, size === 512 ? 'icon.png' : `icon-${size}.png`);
    await generatePNG(LOGO_PATH, outputPath, size);
    console.log(`   ✓ ${path.basename(outputPath)} (${size}x${size})`);
  }
}

async function main() {
  console.log('');
  console.log('🎨 QBox Icon Generator');
  console.log('='.repeat(40));
  console.log(`Source: ${LOGO_PATH}`);
  console.log(`Output: ${ICONS_DIR}`);
  console.log('');
  console.log('Style:');
  console.log(`   Gradient: ${ICON_CONFIG.gradientStart} → ${ICON_CONFIG.gradientEnd}`);
  console.log(`   Corner radius: ${ICON_CONFIG.cornerRadius * 100}%`);
  console.log(`   Logo padding: ${ICON_CONFIG.logoPadding * 100}%`);
  console.log(`   Amber glow: ${ICON_CONFIG.glowEnabled ? 'enabled' : 'disabled'}`);
  console.log('');
  
  // Check if logo exists
  if (!fs.existsSync(LOGO_PATH)) {
    console.error('❌ Logo file not found:', LOGO_PATH);
    process.exit(1);
  }
  
  await ensureDir(ICONS_DIR);
  
  try {
    await generateMacOSIconset();
    console.log('');
    await generateWindowsICO();
    console.log('');
    await generateLinuxPNG();
    console.log('');
    console.log('='.repeat(40));
    console.log('✅ All icons generated successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check the generated icons in assets/icons/');
    console.log('2. Run npm run make to build with new icons');
    console.log('');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();
