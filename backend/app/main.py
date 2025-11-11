from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import connections, metadata, query
from app.api import settings as settings_api
from app.config.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the FastAPI application."""
    # Startup
    print("🚀 Starting QBox API...")
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
