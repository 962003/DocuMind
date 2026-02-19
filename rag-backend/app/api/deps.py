from fastapi import Header, HTTPException, Request

from app.core.config import settings
from app.core.rate_limit import rate_limiter


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    # If BACKEND_API_KEY is empty, keep local/dev mode open.
    if not settings.BACKEND_API_KEY:
        return
    if x_api_key != settings.BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    allowed = rate_limiter.allow(
        key=client_ip,
        max_events=settings.RATE_LIMIT_PER_MINUTE,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
