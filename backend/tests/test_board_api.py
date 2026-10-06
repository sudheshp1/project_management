import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def column(board: dict, key: str) -> dict:
    return next(c for c in board["columns"] if c["id"] == key)


def test_fresh_database_is_created_with_seeded_board(client, database) -> None:
    response = client.get("/api/board")

    assert database.exists()
    assert response.status_code == 200
    board = response.json()
    assert len(board["columns"]) == 5
    assert column(board, "col-backlog")["cardIds"] == ["card-1", "card-2"]
    assert board["cards"]["card-3"]["title"] == "Prototype analytics view"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/board"),
        ("patch", "/api/columns/col-backlog"),
        ("post", "/api/cards"),
        ("patch", "/api/cards/card-1"),
        ("delete", "/api/cards/card-1"),
        ("post", "/api/cards/card-1/move"),
    ],
)
def test_board_routes_require_login(database, method, path) -> None:
    with TestClient(app) as anonymous:
        assert anonymous.request(method, path).status_code == 401


def test_rename_column(client) -> None:
    response = client.patch("/api/columns/col-review", json={"title": "QA"})

    assert response.status_code == 200
    assert column(response.json(), "col-review")["title"] == "QA"
    assert column(client.get("/api/board").json(), "col-review")["title"] == "QA"


def test_card_create_edit_delete(client) -> None:
    response = client.post(
        "/api/cards", json={"columnId": "col-discovery", "title": "Interview users", "details": "Five calls"}
    )
    assert response.status_code == 201
    new_id = column(response.json(), "col-discovery")["cardIds"][-1]

    board = client.patch(f"/api/cards/{new_id}", json={"title": "Interview customers"}).json()
    assert board["cards"][new_id] == {"id": new_id, "title": "Interview customers", "details": "Five calls"}

    board = client.delete(f"/api/cards/{new_id}").json()
    assert new_id not in board["cards"]
    assert column(board, "col-discovery")["cardIds"] == ["card-3"]


def test_move_card_persists_order(client) -> None:
    client.post("/api/cards/card-4/move", json={"columnId": "col-done", "position": 0})
    client.post("/api/cards/card-8/move", json={"columnId": "col-done", "position": 0})

    board = client.get("/api/board").json()
    assert column(board, "col-progress")["cardIds"] == ["card-5"]
    assert column(board, "col-done")["cardIds"] == ["card-8", "card-4", "card-7"]


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("patch", "/api/columns/col-backlog", {"title": ""}),
        ("patch", "/api/columns/col-backlog", {}),
        ("post", "/api/cards", {"columnId": "col-backlog"}),
        ("post", "/api/cards", {"columnId": "col-backlog", "title": "x", "extra": 1}),
        ("patch", "/api/cards/card-1", {"title": ""}),
        ("post", "/api/cards/card-1/move", {"columnId": "col-done", "position": -1}),
        ("post", "/api/cards/card-1/move", {"columnId": "col-done"}),
    ],
)
def test_malformed_input_is_rejected(client, method, path, body) -> None:
    assert client.request(method, path, json=body).status_code == 422


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("patch", "/api/columns/col-missing", {"title": "x"}),
        ("post", "/api/cards", {"columnId": "col-missing", "title": "x"}),
        ("patch", "/api/cards/card-999", {"title": "x"}),
        ("delete", "/api/cards/not-a-card", None),
        ("post", "/api/cards/card-1/move", {"columnId": "col-missing", "position": 0}),
    ],
)
def test_unknown_ids_return_404(client, method, path, body) -> None:
    assert client.request(method, path, json=body).status_code == 404


def test_cannot_touch_another_users_cards(client) -> None:
    client.get("/api/board")
    conn = db.connect()
    other_board = db.board_id_for(conn, "other")
    other_card = db.get_board(conn, other_board)["columns"][0]["cardIds"][0]

    assert client.patch(f"/api/cards/{other_card}", json={"title": "hijack"}).status_code == 404
    assert client.delete(f"/api/cards/{other_card}").status_code == 404
    assert client.post(f"/api/cards/{other_card}/move", json={"columnId": "col-done", "position": 0}).status_code == 404
    assert other_card not in client.get("/api/board").json()["cards"]
    assert db.get_board(conn, other_board)["cards"][other_card]["title"] == "Align roadmap themes"
    conn.close()
