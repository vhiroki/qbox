import logging
import os
import sys
from contextlib import asynccontextmanager

# Fix SSL certificates and HTTP compression for PyInstaller bundles
# This must be done before any imports that use SSL/HTTP (httpx, openai, litellm, etc.)
def _setup_pyinstaller_fixes():
    """Configure SSL certificates and fix HTTP issues for PyInstaller bundles."""
    if not getattr(sys, 'frozen', False):
        return
        
    # Running in a PyInstaller bundle
    bundle_dir = sys._MEIPASS
    
    # 1. Configure SSL certificates
    cert_path = os.path.join(bundle_dir, 'certifi', 'cacert.pem')
    if os.path.exists(cert_path):
        os.environ['SSL_CERT_FILE'] = cert_path
        os.environ['REQUESTS_CA_BUNDLE'] = cert_path
        print(f"🔐 SSL certificates configured: {cert_path}")
    else:
        print(f"⚠️ SSL certificate bundle not found at: {cert_path}")
    
    # 2. Disable HTTP compression for PyInstaller bundles
    # This prevents "Error -3 while decompressing data: incorrect header check"
    # by telling httpx to not request compressed responses
    try:
        import httpx._client
        # Change Accept-Encoding from "gzip, deflate" to "identity"
        # This tells the server to send uncompressed responses
        httpx._client.ACCEPT_ENCODING = "identity"
        print("📦 HTTP compression disabled for PyInstaller compatibility")
    except Exception as e:
        print(f"⚠️ Failed to disable HTTP compression: {e}")

_setup_pyinstaller_fixes()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import connections, files, metadata, query, s3
from app.api import settings as settings_api
from app.config.settings import get_settings
from app.services.migration_service import run_migrations

# Get settings to configure logging
settings = get_settings()

# Configure logging with environment-based level
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Set specific loggers to appropriate levels
logging.getLogger("uvicorn").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# Reduce LiteLLM noise - keep only important messages
logging.getLogger("LiteLLM").setLevel(logging.INFO)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Create logger for main module
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the FastAPI application."""
    # Startup
    print("🚀 Starting QBox API...")

    # Run database migrations
    print("🔄 Checking database migrations...")
    try:
        applied = run_migrations()
        if applied > 0:
            print(f"✅ Applied {applied} database migration(s)")
        else:
            print("✅ Database schema is up to date")
    except Exception as e:
        print(f"⚠️  WARNING: Migration error: {e}")
        logger.exception("Migration failed")
        # Continue startup - this ensures backward compatibility

    logger.info(f"Logging level: {settings.LOG_LEVEL}")
    yield
    # Shutdown
    print("👋 Shutting down QBox API...")


# Create FastAPI application
app = FastAPI(
    title="QBox API",
    description="AI-powered data query application",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    connections.router,
    prefix="/api/connections",
    tags=["connections"],
)
app.include_router(query.router, prefix="/api", tags=["queries"])
app.include_router(metadata.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api", tags=["settings"])
app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(s3.router, prefix="/api", tags=["s3"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "QBox API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Entry point for PyInstaller executable
if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable (set by Electron) or default to 8080
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "127.0.0.1")
    
    print(f"🚀 Starting QBox Backend on {host}:{port}")
    
    # Run uvicorn server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        # Single worker to avoid DuckDB concurrency issues
        workers=1,
    )
