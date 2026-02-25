from functools import lru_cache
import json
import re
from urllib import error, parse, request

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import settings

_PROMPT = ChatPromptTemplate.from_template(
    """You are a document QA assistant.
Answer only from the provided context.
If the answer is not in context, say: "I do not have enough context to answer this accurately."
Use simple, user-friendly language.
Keep the response under 8 short lines.
Format:
1) Direct answer (1-3 lines)
2) Key details (bullet points)

Question:
{question}

Context:
{context}
"""
)


def _gemini_api_key() -> str:
    return settings.GEMINI_API_KEY or settings.API_KEY


def _openrouter_api_key() -> str:
    return settings.OPENROUTER_API_KEY or settings.API_KEY


def _invoke_gemini(prompt: str) -> str:
    api_key = _gemini_api_key()
    if not api_key:
        raise ValueError("missing_api_key")
    model = settings.LLM_MODEL
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={parse.quote(api_key)}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": settings.LLM_TEMPERATURE,
            "maxOutputTokens": settings.LLM_MAX_TOKENS,
        },
    }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"gemini_http_{exc.code}:{detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"gemini_network_error:{exc.reason}") from exc

    try:
        return body["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"gemini_bad_response:{body}")


def _invoke_openrouter(prompt: str) -> str:
    api_key = _openrouter_api_key()
    if not api_key:
        raise ValueError("missing_api_key")
    endpoint = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": settings.LLM_MAX_TOKENS,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if settings.OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
    if settings.OPENROUTER_APP_NAME:
        headers["X-Title"] = settings.OPENROUTER_APP_NAME
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"openrouter_http_{exc.code}:{detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"openrouter_network_error:{exc.reason}") from exc

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"openrouter_bad_response:{body}")


@lru_cache(maxsize=1)
def _get_llm():
    provider = settings.LLM_PROVIDER.lower()
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=settings.LLM_TEMPERATURE,
            num_predict=settings.LLM_MAX_TOKENS,
        )
    if provider == "groq":
        if not settings.GROQ_API_KEY:
            return None
        return ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=settings.LLM_MAX_TOKENS,
        )
    return None


@lru_cache(maxsize=1)
def _get_chain():
    llm = _get_llm()
    if llm is None:
        return None
    return _PROMPT | llm | StrOutputParser()


def generate_answer(question: str, context_chunks: list[str]) -> str:
    if not context_chunks:
        return "I do not have enough context from the selected document to answer that."

    provider = settings.LLM_PROVIDER.lower()
    context_text = "\n\n".join(context_chunks[: settings.ANSWER_MAX_CONTEXT_CHUNKS])[
        : settings.ANSWER_MAX_CONTEXT_CHARS
    ]

    if provider == "gemini":
        if not _gemini_api_key():
            return "LLM is not configured. Set GEMINI_API_KEY (or API_KEY) in backend .env."
        prompt = (
            "You are a document QA assistant.\n"
            "Answer only from the provided context.\n"
            'If the answer is not in context, say: "I do not have enough context to answer this accurately."\n'
            "Use simple, user-friendly language.\n"
            "Keep the response under 8 short lines.\n"
            "Format:\n"
            "1) Direct answer (1-3 lines)\n"
            "2) Key details (bullet points)\n\n"
            f"Question:\n{question}\n\nContext:\n{context_text}"
        )
        try:
            return _invoke_gemini(prompt)
        except Exception as exc:
            message = str(exc)
            if "gemini_http_429" in message or "RESOURCE_EXHAUSTED" in message:
                retry_match = re.search(r"retry in ([0-9]+(?:\\.[0-9]+)?)s", message, flags=re.IGNORECASE)
                if retry_match:
                    wait_seconds = int(float(retry_match.group(1)))
                    return (
                        f"Gemini free-tier quota is temporarily exceeded. "
                        f"Please retry in about {wait_seconds} seconds."
                    )
                return "Gemini free-tier quota is exceeded. Please retry shortly."
            if "gemini_http_401" in message or "API_KEY_INVALID" in message or "missing_api_key" in message:
                return "Gemini authentication failed. Check GEMINI_API_KEY (or API_KEY) in backend .env."
            return f"LLM request failed: {message}"

    if provider == "openrouter":
        if not _openrouter_api_key():
            return "LLM is not configured. Set OPENROUTER_API_KEY (or API_KEY) in backend .env."
        prompt = (
            "You are a document QA assistant.\n"
            "Answer only from the provided context.\n"
            'If the answer is not in context, say: "I do not have enough context to answer this accurately."\n'
            "Use simple, user-friendly language.\n"
            "Keep the response under 8 short lines.\n"
            "Format:\n"
            "1) Direct answer (1-3 lines)\n"
            "2) Key details (bullet points)\n\n"
            f"Question:\n{question}\n\nContext:\n{context_text}"
        )
        try:
            return _invoke_openrouter(prompt)
        except Exception as exc:
            message = str(exc)
            if "openrouter_http_401" in message or "invalid api key" in message.lower() or "missing_api_key" in message:
                return "OpenRouter authentication failed. Check OPENROUTER_API_KEY (or API_KEY) in backend .env."
            if "openrouter_http_429" in message:
                return "OpenRouter rate limit exceeded. Please retry shortly."
            return f"LLM request failed: {message}"

    chain = _get_chain()
    if chain is None:
        if provider == "groq" and not settings.GROQ_API_KEY:
            return "LLM is not configured. Set GROQ_API_KEY to enable generated answers."
        return "LLM provider is not configured."

    try:
        return chain.invoke({"question": question, "context": context_text}).strip()
    except Exception as exc:
        message = str(exc)
        if provider == "groq" and ("invalid_api_key" in message or "401" in message):
            return "Groq authentication failed. Check GROQ_API_KEY in backend .env."
        return f"LLM request failed: {message}"


def warmup_llm() -> None:
    if settings.LLM_PROVIDER.lower() in {"gemini", "openrouter"}:
        # Skip warmup for paid/limited providers to avoid consuming quota on startup.
        return
    chain = _get_chain()
    if chain is None:
        return
    # Warm local model/process so first user query avoids cold-start latency.
    chain.invoke({"question": "warmup", "context": "warmup"})


@lru_cache(maxsize=1)
def check_groq_auth() -> tuple[bool | None, str]:
    provider = settings.LLM_PROVIDER.lower()
    if provider != "groq":
        return None, "provider_not_groq"
    if not settings.GROQ_API_KEY:
        return False, "missing_api_key"
    try:
        llm = ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0,
            max_tokens=1,
        )
        llm.invoke("ping")
        return True, "ok"
    except Exception as exc:
        message = str(exc)
        if "invalid_api_key" in message or "401" in message:
            return False, "invalid_api_key"
        return False, "request_failed"
