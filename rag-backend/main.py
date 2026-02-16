from fastapi import FastAPI
from api.upload import router as upload_router

app = FastAPI(title="RAG Backend")

app.include_router(upload_router)