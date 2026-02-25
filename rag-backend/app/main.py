import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.services.embeddings import get_embeddings
from app.services.llm import warmup_llm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME)

allowed_origins = {origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()}
allowed_origins.add(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def warmup_services() -> None:
    if settings.WARMUP_EMBEDDINGS_ON_STARTUP:
        try:
            get_embeddings().embed_query("warmup")
            logger.info("Embeddings warmup complete")
        except Exception:
            logger.exception("Embeddings warmup failed")
    if settings.WARMUP_LLM_ON_STARTUP:
        try:
            warmup_llm()
            logger.info("LLM warmup complete")
        except Exception:
            logger.exception("LLM warmup failed")
