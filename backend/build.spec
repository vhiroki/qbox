# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for QBox backend
Builds a standalone executable that includes Python and all dependencies
"""

import sys
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Collect all submodules and data files for packages that need it
datas = []
binaries = []
hiddenimports = []

# DuckDB needs special handling
duckdb_datas, duckdb_binaries, duckdb_hidden = collect_all('duckdb')
datas += duckdb_datas
binaries += duckdb_binaries
hiddenimports += duckdb_hidden

# SQLAlchemy and psycopg
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += collect_submodules('psycopg')
hiddenimports += collect_submodules('psycopg_binary')

# FastAPI and dependencies
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('starlette')
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic_core')

# LiteLLM and OpenAI - need data files for tokenizers
litellm_datas, litellm_binaries, litellm_hidden = collect_all('litellm')
datas += litellm_datas
binaries += litellm_binaries
hiddenimports += litellm_hidden

openai_datas, openai_binaries, openai_hidden = collect_all('openai')
datas += openai_datas
binaries += openai_binaries
hiddenimports += openai_hidden

# Tiktoken needs data files for encodings
tiktoken_datas, tiktoken_binaries, tiktoken_hidden = collect_all('tiktoken')
datas += tiktoken_datas
binaries += tiktoken_binaries
hiddenimports += tiktoken_hidden

# Also collect tiktoken_ext which contains the actual encoding definitions
tiktoken_ext_datas, tiktoken_ext_binaries, tiktoken_ext_hidden = collect_all('tiktoken_ext')
datas += tiktoken_ext_datas
binaries += tiktoken_ext_binaries
hiddenimports += tiktoken_ext_hidden

# Boto3 for S3 support
hiddenimports += collect_submodules('boto3')
hiddenimports += collect_submodules('botocore')

# Other dependencies
hiddenimports += [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'sqlite3',
    'json',
    'multipart',
]

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'tkinter',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='qbox-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for logging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

