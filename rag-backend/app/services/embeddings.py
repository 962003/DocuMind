import json
import logging
from urllib import error, parse, request

from app.core.config import settings

logger = logging.getLogger(__name__)

_HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models/{model}"


def _hf_embed(texts: list[str]) -> list[list[float]]:
    model = settings.EMBEDDING_MODEL
    url = _HF_INFERENCE_URL.format(model=model)
    headers = {"Content-Type": "application/json"}
    if settings.HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {settings.HF_API_TOKEN}"

    payload = json.dumps({"inputs": texts}).encode()
    req = request.Request(url, data=payload, headers=headers, method="POST")

    try:
        with request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HuggingFace Inference API error ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"HuggingFace Inference API network error: {exc.reason}") from exc


def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    batch_size = 32
    all_vectors = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        vectors = _hf_embed(batch)
        all_vectors.extend(vectors)
    return all_vectors


def embed_query(text: str) -> list[float]:
    result = _hf_embed([text])
    return result[0]
