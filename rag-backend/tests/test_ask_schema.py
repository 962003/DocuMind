import pytest
from pydantic import ValidationError

from app.schemas.ask import AskRequest, AskResponse, Citation


def test_ask_request_valid():
    req = AskRequest(
        question="What is AI?",
        document_id="550e8400-e29b-41d4-a716-446655440000",
    )
    assert req.question == "What is AI?"
    assert req.top_k == 5


def test_ask_request_empty_question_rejected():
    with pytest.raises(ValidationError):
        AskRequest(
            question="",
            document_id="550e8400-e29b-41d4-a716-446655440000",
        )


def test_ask_request_invalid_uuid_rejected():
    with pytest.raises(ValidationError):
        AskRequest(question="hello", document_id="not-a-uuid")


def test_ask_request_top_k_bounds():
    with pytest.raises(ValidationError):
        AskRequest(
            question="hello",
            document_id="550e8400-e29b-41d4-a716-446655440000",
            top_k=0,
        )
    with pytest.raises(ValidationError):
        AskRequest(
            question="hello",
            document_id="550e8400-e29b-41d4-a716-446655440000",
            top_k=11,
        )


def test_citation_model():
    c = Citation(chunk_id="abc", score=0.95, snippet="some text")
    assert c.chunk_index is None
    assert c.score == 0.95


def test_ask_response_model():
    resp = AskResponse(
        answer="test answer",
        document_id="550e8400-e29b-41d4-a716-446655440000",
    )
    assert resp.citations == []
