// QBox Landing Page - GitHub Releases Integration

const GITHUB_OWNER = 'vhiroki';
const GITHUB_REPO = 'qbox';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

let latestRelease = null;

/**
 * Detect Apple Silicon using WebGL renderer
 * This is the most reliable method as GPU info reveals the chip
 */
function detectAppleSilicon() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;
        
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        
        // Apple Silicon GPUs contain "apple m" (M1, M2, M3, etc.) or "apple gpu"
        if (renderer.includes('apple m') || renderer.includes('apple gpu')) {
            return true;
        }
        
        // Intel GPUs contain "intel"
        if (renderer.includes('intel')) {
            return false;
        }
        
        // AMD GPUs were used in some Intel Macs
        if (renderer.includes('amd') || renderer.includes('radeon')) {
            return false;
        }
        
        return null; // Unknown
    } catch (e) {
        return null;
    }
}

/**
 * Detect user's operating system and architecture
 */
function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';
    
    if (ua.includes('mac') || platform.includes('mac')) {
        // Use WebGL to detect Apple Silicon vs Intel
        const gpuDetection = detectAppleSilicon();
        
        // If GPU detection worked, use it; otherwise default to Apple Silicon
        // (Most Macs sold since late 2020 are Apple Silicon, and Rosetta 2 
        // allows running Intel apps on Apple Silicon anyway)
        const isAppleSilicon = gpuDetection !== false;
        
        return {
            os: 'macos',
            arch: isAppleSilicon ? 'arm64' : 'x64',
            label: isAppleSilicon ? 'Apple Silicon' : 'Intel',
            display: 'macOS'
        };
    }
    
    if (ua.includes('win')) {
        const is64 = platform.includes('64') || ua.includes('wow64') || ua.includes('x64');
        return {
            os: 'windows',
            arch: is64 ? 'x64' : 'x86',
            label: is64 ? '64-bit' : '32-bit',
            display: 'Windows'
        };
    }
    
    if (ua.includes('linux')) {
        return {
            os: 'linux',
            arch: 'x64',
            label: '64-bit',
            display: 'Linux'
        };
    }
    
    return {
        os: 'unknown',
        arch: 'unknown',
        label: '',
        display: 'your platform'
    };
}

/**
 * Find the best matching asset for the user's platform
 */
function findAssetForPlatform(assets, platform) {
    if (!assets || assets.length === 0) return null;
    
    // Sort by preference - we want .dmg for macOS, .exe for Windows, .deb/.AppImage for Linux
    const assetPatterns = {
        macos: {
            arm64: [/arm64.*\.dmg$/i, /\.dmg$/i],
            x64: [/x64.*\.dmg$/i, /intel.*\.dmg$/i, /\.dmg$/i]
        },
        windows: {
            x64: [/\.exe$/i],
            x86: [/\.exe$/i]
        },
        linux: {
            x64: [/\.AppImage$/i, /\.deb$/i]
        }
    };
    
    const patterns = assetPatterns[platform.os]?.[platform.arch] || [];
    
    for (const pattern of patterns) {
        const match = assets.find(a => pattern.test(a.name));
        if (match) return match;
    }
    
    // Fallback: return first downloadable asset
    return assets.find(a => 
        a.name.endsWith('.dmg') || 
        a.name.endsWith('.exe') || 
        a.name.endsWith('.deb') ||
        a.name.endsWith('.AppImage')
    );
}

/**
 * Format file size in human-readable form
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease() {
    try {
        const response = await fetch(RELEASES_API, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch release:', error);
        return null;
    }
}

/**
 * Update the UI with release information
 */
function updateUI(release, platform) {
    const versionBadge = document.getElementById('version-badge');
    const downloadBtn = document.getElementById('download-btn');
    const downloadText = downloadBtn?.querySelector('.download-text');
    const downloadInfo = document.getElementById('download-info');
    
    if (!release) {
        // No release found - link to releases page
        if (versionBadge) versionBadge.textContent = 'beta';
        if (downloadText) downloadText.textContent = `Download for ${platform.display}`;
        if (downloadInfo) downloadInfo.textContent = 'Check releases for available downloads';
        return;
    }
    
    // Update version badge
    const version = release.tag_name?.replace(/^v/, '') || 'latest';
    if (versionBadge) versionBadge.textContent = `v${version}`;
    
    // Find matching asset
    const asset = findAssetForPlatform(release.assets, platform);
    
    if (downloadText) {
        if (platform.os === 'macos' && platform.arch === 'arm64') {
            downloadText.textContent = 'Download for Mac (Apple Silicon)';
        } else if (platform.os === 'macos') {
            downloadText.textContent = 'Download for Mac (Intel)';
        } else {
            downloadText.textContent = `Download for ${platform.display}`;
        }
    }
    
    if (downloadInfo) {
        if (asset) {
            downloadInfo.textContent = `${asset.name} · ${formatSize(asset.size)}`;
        } else if (platform.os === 'macos') {
            downloadInfo.textContent = 'macOS DMG installer';
        } else {
            downloadInfo.textContent = 'View all available downloads';
        }
    }
}

/**
 * Handle download button click
 */
function downloadLatest() {
    const platform = detectPlatform();
    
    if (!latestRelease || !latestRelease.assets) {
        // No release data - go to releases page
        window.open(RELEASES_PAGE, '_blank');
        return;
    }
    
    const asset = findAssetForPlatform(latestRelease.assets, platform);
    
    if (asset && asset.browser_download_url) {
        // Direct download
        window.location.href = asset.browser_download_url;
    } else {
        // Fallback to releases page
        window.open(RELEASES_PAGE, '_blank');
    }
}

/**
 * Initialize the page
 */
async function init() {
    const platform = detectPlatform();
    console.log('Detected platform:', platform);
    
    // Show loading state
    const downloadInfo = document.getElementById('download-info');
    if (downloadInfo) {
        downloadInfo.textContent = 'Checking latest release...';
    }
    
    // Fetch release data
    latestRelease = await fetchLatestRelease();
    
    // Update UI
    updateUI(latestRelease, platform);
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);

// Expose download function globally for onclick handlers
window.downloadLatest = downloadLatest;

