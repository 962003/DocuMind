from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import DocumentChat


def create_user_chat(db: Session, document_id: UUID, question: str) -> UUID | None:
    question_text = (question or "").strip()
    if not question_text:
        return None

    chat = DocumentChat(
        document_id=document_id,
        question=question_text,
        answer="",
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat.id


def save_assistant_response(db: Session, chat_id: UUID | None, answer: str) -> None:
    if chat_id is None:
        return

    chat = db.get(DocumentChat, chat_id)
    if chat is None:
        return

    chat.answer = (answer or "").strip()
    db.add(chat)
    db.commit()


def save_chat(db: Session, document_id: UUID, question: str, answer: str) -> None:
    chat_id = create_user_chat(db=db, document_id=document_id, question=question)
    save_assistant_response(db=db, chat_id=chat_id, answer=answer)


def recent_turns_text(
    db: Session,
    document_id: UUID,
    limit: int,
    exclude_chat_id: UUID | None = None,
) -> str:
    query = (
        db.query(DocumentChat)
        .filter(DocumentChat.document_id == document_id)
        .order_by(desc(DocumentChat.created_at))
    )
    if exclude_chat_id is not None:
        query = query.filter(DocumentChat.id != exclude_chat_id)

    rows = query.limit(max(int(limit), 0)).all()
    if not rows:
        return ""

    parts: list[str] = []
    for row in reversed(rows):
        q = (row.question or "").strip()
        a = (row.answer or "").strip()
        if q:
            parts.append(f"User: {q}")
        if a:
            parts.append(f"Assistant: {a}")
    return "\n".join(parts).strip()


def list_questions(db: Session, document_id: UUID) -> list[str]:
    rows = (
        db.query(DocumentChat)
        .filter(DocumentChat.document_id == document_id)
        .order_by(DocumentChat.created_at.asc())
        .all()
    )
    return [row.question for row in rows if row.question]
