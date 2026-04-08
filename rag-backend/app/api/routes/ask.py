import logging
import re
from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit
from app.core.config import settings
from app.db.session import get_db
from app.models import DocumentChunk, PDFDocument
from app.schemas.ask import AskRequest, AskResponse, AskedQuestionsResponse
from app.services.chat_history import (
    create_user_chat,
    list_questions,
    recent_turns_text,
    save_assistant_response,
)
from app.services.embeddings import embed_query
from app.services.llm import generate_answer, generate_answer_stream

router = APIRouter(tags=["ask"])
logger = logging.getLogger(__name__)
route_dependencies = [Depends(enforce_rate_limit)]


def _build_citations(chunks: list[tuple]) -> list[dict]:
    citations = []
    for chunk, distance in chunks:
        score = 1.0 - distance  # cosine distance → similarity
        content = chunk.content or ""
        snippet = re.sub(r"\s+", " ", content).strip()[:220]
        citations.append(
            {
                "chunk_id": str(chunk.id),
                "chunk_index": chunk.chunk_index,
                "score": round(max(score, 0.0), 6),
                "snippet": snippet,
            }
        )
    return citations


def _retrieve_chunks(request: AskRequest, db: Session) -> tuple[list[str], list[dict]]:
    document = db.get(PDFDocument, request.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.index_status != "completed":
        raise HTTPException(status_code=409, detail=f"Document is not ready. Status: {document.index_status}")

    try:
        query_vector = embed_query(request.question)
        results = (
            db.query(
                DocumentChunk,
                DocumentChunk.embedding.cosine_distance(query_vector).label("distance"),
            )
            .filter(
                DocumentChunk.document_id == request.document_id,
                DocumentChunk.embedding.isnot(None),
            )
            .order_by("distance")
            .limit(request.top_k)
            .all()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    chunk_texts = [chunk.content for chunk, _ in results if chunk.content]
    return chunk_texts, _build_citations(results)


@router.post("/ask", response_model=AskResponse, dependencies=route_dependencies)
def ask(
    request: AskRequest,
    db: Session = Depends(get_db),
):
    start = perf_counter()
    chat_id = create_user_chat(db=db, document_id=request.document_id, question=request.question)
    history_text = recent_turns_text(
        db=db,
        document_id=request.document_id,
        limit=settings.CHAT_HISTORY_WINDOW_TURNS,
        exclude_chat_id=chat_id,
    )
    t0 = perf_counter()
    chunks, citations = _retrieve_chunks(request=request, db=db)
    search_total_ms = (perf_counter() - t0) * 1000
    t2 = perf_counter()
    answer = generate_answer(request.question, chunks, chat_history=history_text)
    save_assistant_response(db=db, chat_id=chat_id, answer=answer)
    llm_ms = (perf_counter() - t2) * 1000
    total_ms = (perf_counter() - start) * 1000

    logger.info(
        "ask latency total=%.1fms retrieval=%.1fms llm=%.1fms top_k=%d hits=%d doc_id=%s",
        total_ms,
        search_total_ms,
        llm_ms,
        request.top_k,
        len(chunks),
        request.document_id,
    )

    return AskResponse(
        answer=answer[: settings.ANSWER_MAX_CHARS],
        document_id=request.document_id,
        citations=citations,
    )


@router.post("/ask/stream", dependencies=route_dependencies)
def ask_stream(
    request: AskRequest,
    db: Session = Depends(get_db),
):
    chat_id = create_user_chat(db=db, document_id=request.document_id, question=request.question)
    history_text = recent_turns_text(
        db=db,
        document_id=request.document_id,
        limit=settings.CHAT_HISTORY_WINDOW_TURNS,
        exclude_chat_id=chat_id,
    )
    chunks, _ = _retrieve_chunks(request=request, db=db)

    def _stream():
        sent = 0
        answer_parts: list[str] = []
        try:
            for token in generate_answer_stream(request.question, chunks, chat_history=history_text):
                if not token:
                    continue
                remaining = settings.ANSWER_MAX_CHARS - sent
                if remaining <= 0:
                    break
                chunk = token[:remaining]
                sent += len(chunk)
                answer_parts.append(chunk)
                yield chunk
        finally:
            save_assistant_response(
                db=db,
                chat_id=chat_id,
                answer="".join(answer_parts),
            )

    return StreamingResponse(_stream(), media_type="text/plain; charset=utf-8")


@router.get("/ask/questions/{document_id}", response_model=AskedQuestionsResponse, dependencies=route_dependencies)
def asked_questions(document_id: UUID, db: Session = Depends(get_db)):
    return AskedQuestionsResponse(
        document_id=document_id,
        questions=list_questions(db=db, document_id=document_id),
    )
