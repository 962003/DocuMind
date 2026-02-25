from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    provider = settings.LLM_PROVIDER.lower()
    if provider == "groq":
        llm_configured = bool(settings.GROQ_API_KEY)
    elif provider == "gemini":
        llm_configured = bool(settings.GEMINI_API_KEY or settings.API_KEY)
    elif provider == "openrouter":
        llm_configured = bool(settings.OPENROUTER_API_KEY or settings.API_KEY)
    else:
        llm_configured = bool(settings.LLM_MODEL)
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "backend_url": settings.BACKEND_URL,
        "llm_provider": provider,
        "llm_configured": llm_configured,
    }
