from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.rate_limit import rate_limiter

bearer_scheme = HTTPBearer(auto_error=False)


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    # If BACKEND_API_KEY is empty, keep local/dev mode open.
    if not settings.BACKEND_API_KEY:
        return
    if x_api_key != settings.BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def require_jwt_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> None:
    if not settings.JWT_AUTH_ENABLED:
        return
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid auth scheme")
    if not settings.JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT is enabled but JWT_SECRET_KEY is not configured")
    try:
        jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    allowed = rate_limiter.allow(
        key=client_ip,
        max_events=settings.RATE_LIMIT_PER_MINUTE,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
