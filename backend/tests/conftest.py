import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture(autouse=True)
def database(tmp_path, monkeypatch):
    path = tmp_path / "data" / "test.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    return path


@pytest.fixture
def conn(database):
    db.init_db()
    connection = db.connect()
    yield connection
    connection.close()


@pytest.fixture
def client(database):
    with TestClient(app) as test_client:
        test_client.post("/api/login", json={"username": "user", "password": "password"})
        yield test_client
