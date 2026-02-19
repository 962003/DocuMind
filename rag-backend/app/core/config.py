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

    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMS: int = 384
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "llama3"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/rag_db"
    # Optional backend auth key for incoming API requests.
    # Keep empty to disable request-header auth.
    BACKEND_API_KEY: str = ""
    RATE_LIMIT_PER_MINUTE: int = 60

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200


settings = Settings()
