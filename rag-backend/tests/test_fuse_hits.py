from app.api.routes.ask import _fuse_hits, _tokens


def test_tokens_basic():
    result = _tokens("Hello World AI")
    assert "hello" in result
    assert "world" in result
    # short tokens (<=2 chars) excluded
    assert "ai" not in result


def test_fuse_hits_empty():
    result = _fuse_hits("some question", [], [], top_k=5)
    assert result == []


def test_fuse_hits_vector_only():
    vector_hits = [
        {"_id": "1", "_source": {"chunk_id": "c1", "chunk_index": 0, "content": "chunk one content"}},
        {"_id": "2", "_source": {"chunk_id": "c2", "chunk_index": 1, "content": "chunk two content"}},
    ]
    result = _fuse_hits("test question here", vector_hits, [], top_k=5)
    assert len(result) == 2
    assert result[0]["score"] >= result[1]["score"]


def test_fuse_hits_respects_top_k():
    hits = [
        {"_id": str(i), "_source": {"chunk_id": f"c{i}", "chunk_index": i, "content": f"content {i}"}}
        for i in range(10)
    ]
    result = _fuse_hits("query", hits, [], top_k=3)
    assert len(result) == 3
