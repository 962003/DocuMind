from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_PATH), env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "RAG Backend"
    FRONTEND_URL: str = "http://127.0.0.1:3000"
    BACKEND_URL: str = "http://127.0.0.1:8000"
    ALLOWED_ORIGINS: str = "http://127.0.0.1:3000,http://localhost:3000"

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 25

    # --- Database (Supabase PostgreSQL with pgvector) ---
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/rag_db"

    # --- Embeddings (API-based, replaces local sentence-transformers) ---
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMS: int = 384
    HF_API_TOKEN: str = ""

    # --- LLM ---
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "llama-3.1-8b-instant"
    LLM_MAX_TOKENS: int = 512
    LLM_TEMPERATURE: float = 0.1
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_SITE_URL: str = ""
    OPENROUTER_APP_NAME: str = "RAG Backend"

    # Backward-compatible key name used in existing .env files.
    API_KEY: str = ""
    RATE_LIMIT_PER_MINUTE: int = 60
    CHAT_HISTORY_WINDOW_TURNS: int = 6

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    ANSWER_MAX_CONTEXT_CHUNKS: int = 3
    ANSWER_MAX_CONTEXT_CHARS: int = 3000
    ANSWER_MAX_CHARS: int = 2500
    WARMUP_LLM_ON_STARTUP: bool = False


settings = Settings()
