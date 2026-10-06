import pytest

from app import db


def column_cards(board: dict, key: str) -> list[str]:
    return next(c["cardIds"] for c in board["columns"] if c["id"] == key)


def test_init_creates_database_file_and_version(database) -> None:
    assert not database.exists()

    db.init_db()

    assert database.exists()
    conn = db.connect()
    assert conn.execute("PRAGMA user_version").fetchone()[0] == db.SCHEMA_VERSION
    conn.close()


def test_first_access_seeds_board_once(conn) -> None:
    board_id = db.board_id_for(conn, "user")

    assert db.board_id_for(conn, "user") == board_id
    board = db.get_board(conn, board_id)
    assert [c["id"] for c in board["columns"]] == [
        "col-backlog", "col-discovery", "col-progress", "col-review", "col-done",
    ]
    assert column_cards(board, "col-backlog") == ["card-1", "card-2"]
    assert len(board["cards"]) == 8
    assert board["cards"]["card-1"]["title"] == "Align roadmap themes"


def test_create_update_delete_card(conn) -> None:
    board_id = db.board_id_for(conn, "user")

    card_id = db.create_card(conn, board_id, "col-review", "New", "Notes")
    db.update_card(conn, board_id, card_id, None, "Changed")
    board = db.get_board(conn, board_id)
    assert column_cards(board, "col-review") == ["card-6", card_id]
    assert board["cards"][card_id] == {"id": card_id, "title": "New", "details": "Changed"}

    db.delete_card(conn, board_id, "card-6")
    assert column_cards(db.get_board(conn, board_id), "col-review") == [card_id]
    positions = conn.execute("SELECT position FROM cards WHERE id = ?", (int(card_id[5:]),)).fetchone()
    assert positions[0] == 0


def test_move_card_within_and_across_columns(conn) -> None:
    board_id = db.board_id_for(conn, "user")

    db.move_card(conn, board_id, "card-1", "col-backlog", 1)
    assert column_cards(db.get_board(conn, board_id), "col-backlog") == ["card-2", "card-1"]

    db.move_card(conn, board_id, "card-2", "col-done", 1)
    board = db.get_board(conn, board_id)
    assert column_cards(board, "col-backlog") == ["card-1"]
    assert column_cards(board, "col-done") == ["card-7", "card-2", "card-8"]

    db.move_card(conn, board_id, "card-1", "col-review", 99)
    assert column_cards(db.get_board(conn, board_id), "col-review") == ["card-6", "card-1"]


def test_operations_are_scoped_to_the_board(conn) -> None:
    user_board = db.board_id_for(conn, "user")
    other_board = db.board_id_for(conn, "other")
    other_card = db.get_board(conn, other_board)["columns"][0]["cardIds"][0]

    for operation in (
        lambda: db.update_card(conn, user_board, other_card, "x", None),
        lambda: db.delete_card(conn, user_board, other_card),
        lambda: db.move_card(conn, user_board, other_card, "col-done", 0),
    ):
        with pytest.raises(db.NotFound):
            operation()

    assert other_card in db.get_board(conn, other_board)["cards"]


@pytest.mark.parametrize("api_id", ["card-abc", "col-1", "1", "card-"])
def test_parse_card_id_rejects_malformed_ids(api_id) -> None:
    with pytest.raises(db.NotFound):
        db.parse_card_id(api_id)
