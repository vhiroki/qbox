from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the project root directory (two levels up from this file)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )

    # Application Configuration
    BACKEND_PORT: int = 8080
    FRONTEND_PORT: int = 5173

    # CORS Configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # AI Provider Configuration (via LiteLLM)
    # LiteLLM supports 100+ providers - set API keys as needed:
    # - OpenAI: OPENAI_API_KEY
    # - Anthropic: ANTHROPIC_API_KEY
    # - Google Vertex AI: VERTEXAI_PROJECT, VERTEXAI_LOCATION (run 'gcloud auth application-default')
    # - Google Gemini: GEMINI_API_KEY
    # - Azure: AZURE_API_KEY, AZURE_API_BASE, AZURE_API_VERSION
    # - AWS Bedrock: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    # - Ollama: No key needed (local)
    # - And many more: https://docs.litellm.ai/docs/providers
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    
    # Model to use - LiteLLM format examples:
    # OpenAI: "gpt-4o", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"
    #         or "openai/gpt-4o"
    # Anthropic: "claude-3-5-sonnet-20241022", "claude-3-opus-20240229"
    #            or "anthropic/claude-3-5-sonnet-20241022"
    # Google: "gemini/gemini-pro", "gemini/gemini-1.5-pro"
    #         or "vertex_ai/gemini-1.5-pro"
    # Ollama: "ollama/llama2", "ollama/codellama", "ollama/mistral"
    # Full list: https://docs.litellm.ai/docs/providers
    AI_MODEL: str = "gpt-4o"
    
    # AI Generation Settings
    AI_TEMPERATURE: float = 0.1  # Lower = more deterministic (0.0 - 2.0)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
