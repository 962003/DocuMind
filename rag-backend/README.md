# RAG Backend

## Queue-Based Ingestion

Upload now uses a producer-consumer flow:

1. `POST /upload` stores the PDF and creates a `pdf_documents` row with `index_status=processing`.
2. API publishes a Celery job to Redis.
3. Celery worker consumes the job and runs PDF parsing/chunking/embedding/indexing.
4. Frontend polls `GET /document-status/{document_id}` until `completed` or `failed`.

## Priority Features Implemented

- Background ingestion with Celery + Redis queue
- Streaming responses via `POST /ask/stream`
- Hybrid retrieval (vector + keyword fusion / RRF)
- HNSW-first index mapping with compatibility fallback
- Source citations in `POST /ask` response
- Optional JWT auth on protected routes

## JWT Auth (Optional)

Set in `.env`:

```env
JWT_AUTH_ENABLED=true
JWT_SECRET_KEY=your-strong-secret
JWT_ALGORITHM=HS256
```

When enabled, include:

```http
Authorization: Bearer <jwt_token>
```

## Run Redis

```bash
docker compose -f docker-compose.queue.yml up -d
```

## Run API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run Worker

```bash
celery -A app.worker.celery_app.celery_app worker -Q ingestion -l info
```
