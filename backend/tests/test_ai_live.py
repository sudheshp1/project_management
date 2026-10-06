import os

import pytest

from app import ai, chat, db

# Calls the real OpenRouter API. Deselected by default; run explicitly with:
#   uv run --env-file ../.env pytest -m live
pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set"),
]


def test_live_openrouter_answers_two_plus_two() -> None:
    reply = ai.complete([{"role": "user", "content": "What is 2+2? Reply with only the number."}])

    assert "4" in reply


def test_live_chat_creates_and_moves_cards(conn) -> None:
    board_id = db.board_id_for(conn, "user")

    result = chat.chat(
        conn,
        board_id,
        [],
        "Add a card titled 'Live test card' to the Review column, "
        "and move 'Align roadmap themes' to the Done column.",
    )

    columns = {c["id"]: [result["board"]["cards"][i]["title"] for i in c["cardIds"]]
               for c in result["board"]["columns"]}
    assert result["reply"]
    assert "Live test card" in columns["col-review"]
    assert "Align roadmap themes" in columns["col-done"]
