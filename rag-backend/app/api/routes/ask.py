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


@router.post("/ask", response_model=AskResponse)
def ask(
    request: AskRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
    __: None = Depends(enforce_rate_limit),
):
    document = db.get(PDFDocument, request.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.index_status != "completed":
        raise HTTPException(status_code=409, detail=f"Document is not ready. Status: {document.index_status}")

    try:
        query_vector = get_embeddings().embed_query(request.question)

        es = Elasticsearch(
            settings.ELASTIC_URL,
            http_auth=(settings.ELASTIC_USER, settings.ELASTIC_PASSWORD),
        )

        response = es.search(
            index=settings.INDEX_NAME,
            body={
                "size": request.top_k,
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}") from exc

    hits = response.get("hits", {}).get("hits", [])
    chunks = [hit.get("_source", {}).get("content", "") for hit in hits if hit.get("_source", {}).get("content")]
    answer = generate_answer(request.question, chunks)
    return AskResponse(answer=answer[:2500], document_id=request.document_id)
