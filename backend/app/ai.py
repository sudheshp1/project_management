import os

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"
TIMEOUT_SECONDS = 60


class AIError(Exception):
    """The AI request could not be completed. Messages never include the API key."""


class AINotConfigured(AIError):
    pass


def complete(
    messages: list[dict],
    response_format: dict | None = None,
    transport: httpx.BaseTransport | None = None,
) -> str:
    """Send a chat completion request to OpenRouter and return the reply text."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise AINotConfigured("OPENROUTER_API_KEY is not set")

    payload: dict = {"model": MODEL, "messages": messages}
    if response_format is not None:
        payload["response_format"] = response_format
        # Route only to providers that honor the response format.
        payload["provider"] = {"require_parameters": True}

    try:
        with httpx.Client(transport=transport, timeout=TIMEOUT_SECONDS) as client:
            response = client.post(
                OPENROUTER_URL, json=payload, headers={"Authorization": f"Bearer {api_key}"}
            )
    except httpx.HTTPError as exc:
        raise AIError(f"OpenRouter request failed: {type(exc).__name__}") from None

    if response.is_error:
        raise AIError(f"OpenRouter returned status {response.status_code}")

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise AIError("OpenRouter returned an unexpected response") from None
    if not isinstance(content, str):
        raise AIError("OpenRouter returned an unexpected response")
    return content
