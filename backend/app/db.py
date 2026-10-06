import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

DEFAULT_PATH = Path(__file__).parent.parent / "data" / "app.db"

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE (board_id, key),
  UNIQUE (board_id, position)
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_column_position ON cards (column_id, position);
"""

SEED_BOARD = [
    ("col-backlog", "Backlog", [
        ("Align roadmap themes", "Draft quarterly themes with impact statements and metrics."),
        ("Gather customer signals", "Review support tags, sales notes, and churn feedback."),
    ]),
    ("col-discovery", "Discovery", [
        ("Prototype analytics view", "Sketch initial dashboard layout and key drill-downs."),
    ]),
    ("col-progress", "In Progress", [
        ("Refine status language", "Standardize column labels and tone across the board."),
        ("Design card layout", "Add hierarchy and spacing for scanning dense lists."),
    ]),
    ("col-review", "Review", [
        ("QA micro-interactions", "Verify hover, focus, and loading states."),
    ]),
    ("col-done", "Done", [
        ("Ship marketing page", "Final copy approved and asset pack delivered."),
        ("Close onboarding sprint", "Document release notes and share internally."),
    ]),
]


class NotFound(Exception):
    pass


def database_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", DEFAULT_PATH))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(database_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    database_path().parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    with conn:
        conn.executescript(SCHEMA)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def card_api_id(card_id: int) -> str:
    return f"card-{card_id}"


def parse_card_id(api_id: str) -> int:
    prefix, _, number = api_id.partition("-")
    if prefix != "card" or not number.isdigit():
        raise NotFound
    return int(number)


def board_id_for(conn: sqlite3.Connection, username: str) -> int:
    """Return the user's board id, creating the user and seeded board on first access."""
    row = conn.execute(
        "SELECT boards.id FROM boards JOIN users ON users.id = boards.user_id WHERE users.username = ?",
        (username,),
    ).fetchone()
    if row:
        return row["id"]
    with conn:
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
        user_id = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()["id"]
        board_id = conn.execute("INSERT INTO boards (user_id) VALUES (?)", (user_id,)).lastrowid
        for position, (key, title, cards) in enumerate(SEED_BOARD):
            column_id = conn.execute(
                "INSERT INTO columns (board_id, key, title, position) VALUES (?, ?, ?, ?)",
                (board_id, key, title, position),
            ).lastrowid
            conn.executemany(
                "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
                [(column_id, t, d, i) for i, (t, d) in enumerate(cards)],
            )
    return board_id


def get_board(conn: sqlite3.Connection, board_id: int) -> dict:
    columns = conn.execute(
        "SELECT id, key, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
    ).fetchall()
    cards = conn.execute(
        "SELECT cards.id, cards.column_id, cards.title, cards.details FROM cards"
        " JOIN columns ON columns.id = cards.column_id"
        " WHERE columns.board_id = ? ORDER BY cards.position",
        (board_id,),
    ).fetchall()
    return {
        "columns": [
            {
                "id": column["key"],
                "title": column["title"],
                "cardIds": [card_api_id(c["id"]) for c in cards if c["column_id"] == column["id"]],
            }
            for column in columns
        ],
        "cards": {
            card_api_id(c["id"]): {"id": card_api_id(c["id"]), "title": c["title"], "details": c["details"]}
            for c in cards
        },
    }


def _column_id(conn: sqlite3.Connection, board_id: int, key: str) -> int:
    row = conn.execute(
        "SELECT id FROM columns WHERE board_id = ? AND key = ?", (board_id, key)
    ).fetchone()
    if row is None:
        raise NotFound
    return row["id"]


def _card_column_id(conn: sqlite3.Connection, board_id: int, api_id: str) -> int:
    row = conn.execute(
        "SELECT cards.column_id FROM cards JOIN columns ON columns.id = cards.column_id"
        " WHERE cards.id = ? AND columns.board_id = ?",
        (parse_card_id(api_id), board_id),
    ).fetchone()
    if row is None:
        raise NotFound
    return row["column_id"]


def _card_ids(conn: sqlite3.Connection, column_id: int) -> list[int]:
    rows = conn.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position", (column_id,)
    ).fetchall()
    return [row["id"] for row in rows]


def _write_order(conn: sqlite3.Connection, column_id: int, card_ids: list[int]) -> None:
    conn.executemany(
        "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
        [(column_id, position, card_id) for position, card_id in enumerate(card_ids)],
    )


def rename_column(conn: sqlite3.Connection, board_id: int, key: str, title: str) -> None:
    column_id = _column_id(conn, board_id, key)
    with conn:
        conn.execute("UPDATE columns SET title = ? WHERE id = ?", (title, column_id))


def create_card(conn: sqlite3.Connection, board_id: int, key: str, title: str, details: str) -> str:
    column_id = _column_id(conn, board_id, key)
    with conn:
        card_id = conn.execute(
            "INSERT INTO cards (column_id, title, details, position)"
            " VALUES (?, ?, ?, (SELECT count(*) FROM cards WHERE column_id = ?))",
            (column_id, title, details, column_id),
        ).lastrowid
    return card_api_id(card_id)


def update_card(
    conn: sqlite3.Connection, board_id: int, api_id: str, title: str | None, details: str | None
) -> None:
    _card_column_id(conn, board_id, api_id)
    with conn:
        conn.execute(
            "UPDATE cards SET title = coalesce(?, title), details = coalesce(?, details) WHERE id = ?",
            (title, details, parse_card_id(api_id)),
        )


def delete_card(conn: sqlite3.Connection, board_id: int, api_id: str) -> None:
    column_id = _card_column_id(conn, board_id, api_id)
    with conn:
        conn.execute("DELETE FROM cards WHERE id = ?", (parse_card_id(api_id),))
        _write_order(conn, column_id, _card_ids(conn, column_id))


def move_card(
    conn: sqlite3.Connection, board_id: int, api_id: str, key: str, position: int | None
) -> None:
    """Move a card to a 0-based position in a column; None appends it to the end."""
    card_id = parse_card_id(api_id)
    source_id = _card_column_id(conn, board_id, api_id)
    target_id = _column_id(conn, board_id, key)
    with conn:
        source = [i for i in _card_ids(conn, source_id) if i != card_id]
        target = source if source_id == target_id else _card_ids(conn, target_id)
        target.insert(len(target) if position is None else min(position, len(target)), card_id)
        if source_id != target_id:
            _write_order(conn, source_id, source)
        _write_order(conn, target_id, target)
