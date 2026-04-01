import logging
import re
from functools import lru_cache
from time import perf_counter
from uuid import UUID

from elasticsearch import Elasticsearch
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit
from app.core.config import settings
from app.db.session import get_db
from app.models import PDFDocument
from app.schemas.ask import AskRequest, AskResponse, AskedQuestionsResponse
from app.services.chat_history import (
    create_user_chat,
    list_questions,
    recent_turns_text,
    save_assistant_response,
)
from app.services.embeddings import get_embeddings
from app.services.llm import generate_answer, generate_answer_stream

router = APIRouter(tags=["ask"])
logger = logging.getLogger(__name__)
route_dependencies = [Depends(enforce_rate_limit)]

_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")


@lru_cache(maxsize=1)
def _get_es_client() -> Elasticsearch:
    return Elasticsearch(
        settings.ELASTIC_URL,
        http_auth=(settings.ELASTIC_USER, settings.ELASTIC_PASSWORD),
    )


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 2}


def _vector_search_hits(es: Elasticsearch, request: AskRequest, query_vector: list[float], size: int) -> list[dict]:
    response = es.search(
        index=settings.INDEX_NAME,
        body={
            "size": size,
            "query": {
                "script_score": {
                    "query": {
                        "term": {
                            "document_id": str(request.document_id)
                        }
                    },
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": query_vector},
                    },
                }
            },
        },
    )
    return response.get("hits", {}).get("hits", [])


def _keyword_search_hits(es: Elasticsearch, request: AskRequest, size: int) -> list[dict]:
    response = es.search(
        index=settings.INDEX_NAME,
        body={
            "size": size,
            "query": {
                "bool": {
                    "must": [
                        {"term": {"document_id": str(request.document_id)}},
                        {"match": {"content": {"query": request.question}}},
                    ]
                }
            },
        },
    )
    return response.get("hits", {}).get("hits", [])


def _fuse_hits(question: str, vector_hits: list[dict], keyword_hits: list[dict], top_k: int) -> list[dict]:
    rrf_k = max(settings.HYBRID_RRF_K, 1)
    fused: dict[str, dict] = {}
    q_tokens = _tokens(question)

    for rank, hit in enumerate(vector_hits, start=1):
        source = hit.get("_source", {})
        chunk_id = source.get("chunk_id") or hit.get("_id")
        if not chunk_id:
            continue
        entry = fused.setdefault(
            chunk_id,
            {
                "chunk_id": chunk_id,
                "chunk_index": source.get("chunk_index"),
                "content": source.get("content", ""),
                "score": 0.0,
            },
        )
        entry["score"] += settings.HYBRID_VECTOR_WEIGHT * (1.0 / (rrf_k + rank))

    for rank, hit in enumerate(keyword_hits, start=1):
        source = hit.get("_source", {})
        chunk_id = source.get("chunk_id") or hit.get("_id")
        if not chunk_id:
            continue
        entry = fused.setdefault(
            chunk_id,
            {
                "chunk_id": chunk_id,
                "chunk_index": source.get("chunk_index"),
                "content": source.get("content", ""),
                "score": 0.0,
            },
        )
        entry["score"] += settings.HYBRID_KEYWORD_WEIGHT * (1.0 / (rrf_k + rank))

    for entry in fused.values():
        content = entry.get("content", "")
        if not content or not q_tokens:
            continue
        c_tokens = _tokens(content)
        overlap = len(q_tokens & c_tokens)
        relevance = overlap / max(len(q_tokens), 1)
        entry["score"] += 0.15 * relevance

    ranked = sorted(fused.values(), key=lambda item: item["score"], reverse=True)
    return ranked[:top_k]


def _build_citations(chunks: list[dict]) -> list[dict]:
    citations = []
    for item in chunks:
        content = item.get("content", "")
        snippet = re.sub(r"\s+", " ", content).strip()[:220]
        citations.append(
            {
                "chunk_id": item.get("chunk_id", ""),
                "chunk_index": item.get("chunk_index"),
                "score": round(float(item.get("score", 0.0)), 6),
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
        query_vector = get_embeddings().embed_query(request.question)
        es = _get_es_client()
        size = min(request.top_k * max(settings.HYBRID_CANDIDATE_MULTIPLIER, 1), 50)
        vector_hits = _vector_search_hits(es=es, request=request, query_vector=query_vector, size=size)
        if settings.ENABLE_HYBRID_SEARCH:
            keyword_hits = _keyword_search_hits(es=es, request=request, size=size)
        else:
            keyword_hits = []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    fused_chunks = _fuse_hits(
        question=request.question,
        vector_hits=vector_hits,
        keyword_hits=keyword_hits,
        top_k=request.top_k,
    )
    chunk_texts = [item["content"] for item in fused_chunks if item.get("content")]
    return chunk_texts, _build_citations(fused_chunks)


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
