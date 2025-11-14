import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import connections, files, metadata, query, s3
from app.api import settings as settings_api
from app.config.settings import get_settings

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the FastAPI application."""
    # Startup
    print("🚀 Starting QBox API...")
    print("📊 Debug logging enabled for AI and metadata services")
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

# Get settings
settings = get_settings()

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
