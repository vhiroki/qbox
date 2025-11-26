#!/usr/bin/env python3
"""
Build script for QBox backend using PyInstaller
Handles cross-platform builds and includes all necessary dependencies
"""

import subprocess
import sys
import platform
import os
from pathlib import Path


def get_platform_info():
    """Get current platform information"""
    system = platform.system().lower()
    machine = platform.machine().lower()
    return system, machine


def build_backend():
    """Build the backend executable using PyInstaller"""
    system, machine = get_platform_info()
    
    print(f"🔨 Building QBox backend for {system}/{machine}...")
    print(f"Python version: {sys.version}")
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    spec_file = script_dir / "build.spec"
    
    if not spec_file.exists():
        print(f"❌ Error: build.spec not found at {spec_file}")
        sys.exit(1)
    
    # Check if PyInstaller is installed
    try:
        import PyInstaller
        print(f"✓ PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("❌ Error: PyInstaller not installed")
        print("Install with: pip install pyinstaller")
        sys.exit(1)
    
    # Build command
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        str(spec_file),
    ]
    
    print(f"\n🚀 Running: {' '.join(cmd)}\n")
    
    try:
        # Run PyInstaller
        result = subprocess.run(
            cmd,
            cwd=script_dir,
            check=True,
            capture_output=False,
            text=True,
        )
        
        # Check if executable was created
        dist_dir = script_dir / "dist"
        exe_name = "qbox-backend.exe" if system == "windows" else "qbox-backend"
        exe_path = dist_dir / exe_name
        
        if exe_path.exists():
            print(f"\n✅ Build successful!")
            print(f"📦 Executable: {exe_path}")
            print(f"📏 Size: {exe_path.stat().st_size / (1024*1024):.1f} MB")
        else:
            print(f"\n⚠️  Warning: Expected executable not found at {exe_path}")
            print("Check the dist directory for output files")
        
        return 0
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Build failed with exit code {e.returncode}")
        return e.returncode
    except KeyboardInterrupt:
        print("\n\n⚠️  Build interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(build_backend())

