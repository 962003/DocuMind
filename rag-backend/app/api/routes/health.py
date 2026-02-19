from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "backend_url": settings.BACKEND_URL,
        "llm_configured": bool(settings.GROQ_API_KEY),
    }
