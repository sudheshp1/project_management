from pathlib import Path
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.auth import SESSION_COOKIE, authenticate, current_user, end_session

app = FastAPI(title="Project Management API")


class Credentials(BaseModel):
    username: str
    password: str


class User(BaseModel):
    username: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, response: Response) -> User:
    token = authenticate(credentials.username, credentials.password)
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="strict")
    return User(username=credentials.username)


@app.post("/api/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> None:
    end_session(session)
    response.delete_cookie(SESSION_COOKIE)


@app.get("/api/me")
def me(username: Annotated[str, Depends(current_user)]) -> User:
    return User(username=username)


static_directory = Path(__file__).parent.parent / "static"
app.mount("/", StaticFiles(directory=static_directory, html=True, check_dir=False), name="static")
