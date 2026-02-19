from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import settings

_PROMPT = ChatPromptTemplate.from_template(
    """You are a document QA assistant.
Answer only from the provided context.
If the answer is not in context, say you do not have enough context.

Question:
{question}

Context:
{context}
"""
)


def generate_answer(question: str, context_chunks: list[str]) -> str:
    if not context_chunks:
        return "I do not have enough context from the selected document to answer that."

    provider = settings.LLM_PROVIDER.lower()
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        llm = ChatOllama(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0.1,
        )
    elif provider == "groq":
        if not settings.GROQ_API_KEY:
            return "LLM is not configured. Set GROQ_API_KEY to enable generated answers."
        llm = ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.1,
        )
    else:
        return "LLM provider is not configured."

    chain = _PROMPT | llm | StrOutputParser()
    context_text = "\n\n".join(context_chunks[:8])
    return chain.invoke({"question": question, "context": context_text}).strip()
