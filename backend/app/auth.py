import secrets
from typing import Annotated

from fastapi import Cookie, HTTPException, status

SESSION_COOKIE = "session"

USERS = {"user": "password"}

sessions: dict[str, str] = {}


def authenticate(username: str, password: str) -> str | None:
    if USERS.get(username) != password:
        return None
    token = secrets.token_urlsafe(32)
    sessions[token] = username
    return token


def end_session(token: str | None) -> None:
    if token:
        sessions.pop(token, None)


def current_user(
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> str:
    username = sessions.get(session) if session else None
    if username is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return username
