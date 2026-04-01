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

    ELASTIC_URL: str = "http://localhost:9200"
    ELASTIC_USER: str = "elastic"
    ELASTIC_PASSWORD: str = "changeme"
    INDEX_NAME: str = "rag_documents"
    ENABLE_HYBRID_SEARCH: bool = True
    HYBRID_VECTOR_WEIGHT: float = 0.65
    HYBRID_KEYWORD_WEIGHT: float = 0.35
    HYBRID_RRF_K: int = 60
    HYBRID_CANDIDATE_MULTIPLIER: int = 3
    ENABLE_HNSW_INDEX: bool = True
    HNSW_M: int = 16
    HNSW_EF_CONSTRUCTION: int = 100

    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMS: int = 384
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "llama3"
    LLM_MAX_TOKENS: int = 128
    LLM_TEMPERATURE: float = 0.1
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_SITE_URL: str = ""
    OPENROUTER_APP_NAME: str = "RAG Backend"
    INGESTION_USE_QUEUE: bool = False
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    # Backward-compatible key name used in existing .env files.
    API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/rag_db"
    RATE_LIMIT_PER_MINUTE: int = 60
    CHAT_HISTORY_WINDOW_TURNS: int = 6

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    ANSWER_MAX_CONTEXT_CHUNKS: int = 3
    ANSWER_MAX_CONTEXT_CHARS: int = 3000
    ANSWER_MAX_CHARS: int = 2500
    WARMUP_EMBEDDINGS_ON_STARTUP: bool = True
    WARMUP_LLM_ON_STARTUP: bool = True


settings = Settings()
