import json

import pytest

from app import chat, db


def op(type, cardId=None, columnId=None, title=None, details=None, position=None) -> dict:
    return {
        "type": type, "cardId": cardId, "columnId": columnId,
        "title": title, "details": details, "position": position,
    }


def output(*operations, reply="Done.") -> str:
    return json.dumps({"reply": reply, "operations": list(operations)})


@pytest.fixture
def board(conn):
    board_id = db.board_id_for(conn, "user")
    return board_id, db.get_board(conn, board_id)


def test_parses_reply_without_operations(board) -> None:
    response = chat.parse_response(output(reply="Hello"), board[1])

    assert response.reply == "Hello"
    assert response.operations == []


def test_parses_valid_operations(board) -> None:
    content = output(
        op("create", columnId="col-backlog", title="New", details="Notes"),
        op("update", cardId="card-1", details="Changed"),
        op("move", cardId="card-2", columnId="col-done", position=0),
        op("move", cardId="card-3", columnId="col-done"),
    )

    response = chat.parse_response(content, board[1])

    assert [o.type for o in response.operations] == ["create", "update", "move", "move"]


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        json.dumps({"reply": "missing operations"}),
        json.dumps({"operations": []}),
        output(op("delete", cardId="card-1")),
        output({"type": "create", "columnId": "col-backlog", "title": "x", "extra": 1}),
    ],
)
def test_rejects_malformed_output(board, content) -> None:
    with pytest.raises(chat.InvalidAIResponse):
        chat.parse_response(content, board[1])


@pytest.mark.parametrize(
    "operation",
    [
        op("create", columnId="col-missing", title="x"),
        op("create", columnId="col-backlog"),
        op("create", columnId="col-backlog", title=""),
        op("create", columnId="col-backlog", title="x" * 201),
        op("update", cardId="card-999", title="x"),
        op("update", cardId="card-1"),
        op("move", cardId="card-1", columnId="col-missing"),
        op("move", cardId="card-999", columnId="col-done"),
        op("move", cardId="card-1", columnId="col-done", position=-1),
    ],
)
def test_rejects_operations_that_do_not_fit_the_board(board, operation) -> None:
    with pytest.raises(chat.InvalidAIResponse):
        chat.parse_response(output(operation), board[1])


def test_apply_operations_changes_the_board(conn, board) -> None:
    board_id, current = board
    response = chat.parse_response(
        output(
            op("create", columnId="col-review", title="Write tests"),
            op("update", cardId="card-1", title="Renamed"),
            op("move", cardId="card-2", columnId="col-done", position=0),
            op("move", cardId="card-3", columnId="col-done"),
        ),
        current,
    )

    chat.apply_operations(conn, board_id, response.operations)

    updated = db.get_board(conn, board_id)
    columns = {c["id"]: c["cardIds"] for c in updated["columns"]}
    assert columns["col-review"] == ["card-6", "card-9"]
    assert updated["cards"]["card-9"] == {"id": "card-9", "title": "Write tests", "details": ""}
    assert updated["cards"]["card-1"]["title"] == "Renamed"
    assert columns["col-done"] == ["card-2", "card-7", "card-8", "card-3"]
