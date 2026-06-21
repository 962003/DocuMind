import io

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app

# The /upload route requires authentication. These tests exercise the file
# validation paths (rejecting non-PDF / empty uploads), both of which fire
# before current_user is ever used, so we stub the auth dependency out.
app.dependency_overrides[get_current_user] = lambda: object()

client = TestClient(app)


def test_upload_rejects_non_pdf():
    file = io.BytesIO(b"not a pdf")
    response = client.post("/upload", files={"file": ("test.txt", file, "text/plain")})
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_upload_rejects_empty_file():
    file = io.BytesIO(b"")
    response = client.post("/upload", files={"file": ("test.pdf", file, "application/pdf")})
    assert response.status_code == 400
    assert "Empty" in response.json()["detail"]
