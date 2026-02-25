import logging
import re
from functools import lru_cache
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from elasticsearch import Elasticsearch
from sqlalchemy.orm import Session

from app.api.deps import enforce_rate_limit, require_api_key
from app.core.config import settings
from app.db.session import get_db
from app.models import PDFDocument
from app.schemas.ask import AskRequest, AskResponse
from app.services.embeddings import get_embeddings
from app.services.llm import generate_answer

router = APIRouter(tags=["ask"])
logger = logging.getLogger(__name__)
route_dependencies = [Depends(enforce_rate_limit)]
if settings.BACKEND_API_KEY:
    route_dependencies.append(Depends(require_api_key))

_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")


@lru_cache(maxsize=1)
def _get_es_client() -> Elasticsearch:
    return Elasticsearch(
        settings.ELASTIC_URL,
        http_auth=(settings.ELASTIC_USER, settings.ELASTIC_PASSWORD),
    )


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 2}


def _select_best_chunks(question: str, hits: list[dict], top_k: int) -> list[str]:
    q_tokens = _tokens(question)
    ranked: list[tuple[float, str]] = []
    for hit in hits:
        source = hit.get("_source", {})
        content = source.get("content", "")
        if not content:
            continue
        base_score = float(hit.get("_score", 0.0))
        if not q_tokens:
            relevance = 0.0
        else:
            c_tokens = _tokens(content)
            overlap = len(q_tokens & c_tokens)
            relevance = overlap / max(len(q_tokens), 1)
        combined = base_score + (1.25 * relevance)
        ranked.append((combined, content))

    ranked.sort(key=lambda item: item[0], reverse=True)
    return [content for _, content in ranked[:top_k]]


@router.post("/ask", response_model=AskResponse, dependencies=route_dependencies)
def ask(
    request: AskRequest,
    db: Session = Depends(get_db),
):
    document = db.get(PDFDocument, request.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.index_status != "completed":
        raise HTTPException(status_code=409, detail=f"Document is not ready. Status: {document.index_status}")

    start = perf_counter()
    try:
        t0 = perf_counter()
        query_vector = get_embeddings().embed_query(request.question)
        embedding_ms = (perf_counter() - t0) * 1000

        es = _get_es_client()

        t1 = perf_counter()
        response = es.search(
            index=settings.INDEX_NAME,
            body={
                "size": min(request.top_k * 3, 30),
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
        search_ms = (perf_counter() - t1) * 1000
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    hits = response.get("hits", {}).get("hits", [])
    chunks = _select_best_chunks(request.question, hits, request.top_k)
    t2 = perf_counter()
    answer = generate_answer(request.question, chunks)
    llm_ms = (perf_counter() - t2) * 1000
    total_ms = (perf_counter() - start) * 1000

    logger.info(
        "ask latency total=%.1fms embed=%.1fms search=%.1fms llm=%.1fms top_k=%d hits=%d doc_id=%s",
        total_ms,
        embedding_ms,
        search_ms,
        llm_ms,
        request.top_k,
        len(chunks),
        request.document_id,
    )

    return AskResponse(answer=answer[: settings.ANSWER_MAX_CHARS], document_id=request.document_id)
