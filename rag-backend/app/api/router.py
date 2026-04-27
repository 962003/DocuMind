from fastapi import APIRouter

from app.api.routes.ask import router as ask_router
from app.api.routes.auth import router as auth_router
from app.api.routes.document_status import router as document_status_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.api.routes.upload import router as upload_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(upload_router)
api_router.include_router(document_status_router)
api_router.include_router(documents_router)
api_router.include_router(ask_router)
