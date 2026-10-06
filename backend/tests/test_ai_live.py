import os

import pytest

from app import ai

# Calls the real OpenRouter API. Deselected by default; run explicitly with:
#   uv run --env-file ../.env pytest -m live
pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set"),
]


def test_live_openrouter_answers_two_plus_two() -> None:
    reply = ai.complete([{"role": "user", "content": "What is 2+2? Reply with only the number."}])

    assert "4" in reply
