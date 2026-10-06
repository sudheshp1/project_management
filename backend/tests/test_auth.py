from fastapi.testclient import TestClient

from app.auth import authenticate, sessions
from app.main import app


def login(client: TestClient, password: str = "password"):
    return client.post("/api/login", json={"username": "user", "password": password})


def test_authenticate_accepts_only_hardcoded_credentials() -> None:
    assert authenticate("user", "wrong") is None
    assert authenticate("other", "password") is None

    token = authenticate("user", "password")

    assert token is not None
    assert sessions[token] == "user"


def test_me_requires_session() -> None:
    client = TestClient(app)

    assert client.get("/api/me").status_code == 401

    client.cookies.set("session", "forged")
    assert client.get("/api/me").status_code == 401


def test_login_rejects_invalid_credentials() -> None:
    client = TestClient(app)

    response = login(client, password="wrong")

    assert response.status_code == 401
    assert "session" not in response.cookies


def test_login_logout_flow() -> None:
    client = TestClient(app)

    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "httponly" in response.headers["set-cookie"].lower()

    assert client.get("/api/me").json() == {"username": "user"}

    token = client.cookies["session"]
    assert client.post("/api/logout").status_code == 204
    assert token not in sessions
    assert client.get("/api/me").status_code == 401
