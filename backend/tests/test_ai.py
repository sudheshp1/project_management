import json

import httpx
import pytest

from app import ai

KEY = "sk-test-secret"


@pytest.fixture
def api_key(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", KEY)


def transport(handler):
    return httpx.MockTransport(handler)


def reply(content):
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": content}}]})


def test_builds_request_and_parses_reply(api_key) -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = json.loads(request.content)
        return reply("4")

    messages = [{"role": "user", "content": "What is 2+2?"}]

    assert ai.complete(messages, transport=transport(handler)) == "4"
    assert seen["url"] == ai.OPENROUTER_URL
    assert seen["auth"] == f"Bearer {KEY}"
    assert seen["body"] == {"model": "openai/gpt-oss-120b", "messages": messages}


def test_sends_response_format_when_given(api_key) -> None:
    seen = {}
    response_format = {"type": "json_schema", "json_schema": {"name": "x", "schema": {}}}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return reply("{}")

    ai.complete([], response_format=response_format, transport=transport(handler))

    assert seen["body"]["response_format"] == response_format


def test_missing_key_fails_without_calling_upstream(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("should not call OpenRouter")

    with pytest.raises(ai.AINotConfigured):
        ai.complete([], transport=transport(handler))


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={"error": {"message": "bad key"}}),
        httpx.Response(500, text="upstream down"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": None}}]}),
    ],
)
def test_upstream_errors_raise_ai_error_without_leaking_key(api_key, response) -> None:
    with pytest.raises(ai.AIError) as error:
        ai.complete([], transport=transport(lambda request: response))

    assert KEY not in str(error.value)


def test_network_failure_raises_ai_error(api_key) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(ai.AIError, match="ConnectError"):
        ai.complete([], transport=transport(handler))
