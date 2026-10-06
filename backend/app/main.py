import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import ai, chat, db
from app.auth import SESSION_COOKIE, authenticate, current_user, end_session
from app.schemas import (
    Board,
    CardCreate,
    CardMove,
    CardUpdate,
    ChatRequest,
    ChatResponse,
    ColumnUpdate,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Project Management API", lifespan=lifespan)


@app.exception_handler(db.NotFound)
def not_found(request: Request, exc: db.NotFound) -> JSONResponse:
    return JSONResponse({"detail": "Not found"}, status_code=status.HTTP_404_NOT_FOUND)


@app.exception_handler(ai.AIError)
def ai_error(request: Request, exc: ai.AIError) -> JSONResponse:
    if isinstance(exc, ai.AINotConfigured):
        return JSONResponse({"detail": "AI is not configured"}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return JSONResponse({"detail": str(exc)}, status_code=status.HTTP_502_BAD_GATEWAY)


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


Connection = Annotated[sqlite3.Connection, Depends(db.get_db)]


def current_board(conn: Connection, username: Annotated[str, Depends(current_user)]) -> int:
    return db.board_id_for(conn, username)


BoardId = Annotated[int, Depends(current_board)]


@app.get("/api/board")
def read_board(conn: Connection, board_id: BoardId) -> Board:
    return db.get_board(conn, board_id)


@app.patch("/api/columns/{column_id}")
def rename_column(column_id: str, body: ColumnUpdate, conn: Connection, board_id: BoardId) -> Board:
    db.rename_column(conn, board_id, column_id, body.title)
    return db.get_board(conn, board_id)


@app.post("/api/cards", status_code=status.HTTP_201_CREATED)
def create_card(body: CardCreate, conn: Connection, board_id: BoardId) -> Board:
    db.create_card(conn, board_id, body.column_id, body.title, body.details)
    return db.get_board(conn, board_id)


@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, body: CardUpdate, conn: Connection, board_id: BoardId) -> Board:
    db.update_card(conn, board_id, card_id, body.title, body.details)
    return db.get_board(conn, board_id)


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str, conn: Connection, board_id: BoardId) -> Board:
    db.delete_card(conn, board_id, card_id)
    return db.get_board(conn, board_id)


@app.post("/api/cards/{card_id}/move")
def move_card(card_id: str, body: CardMove, conn: Connection, board_id: BoardId) -> Board:
    db.move_card(conn, board_id, card_id, body.column_id, body.position)
    return db.get_board(conn, board_id)


@app.post("/api/chat")
def send_chat(body: ChatRequest, conn: Connection, board_id: BoardId) -> ChatResponse:
    return chat.chat(conn, board_id, body.history, body.message)


static_directory = Path(__file__).parent.parent / "static"
app.mount("/", StaticFiles(directory=static_directory, html=True, check_dir=False), name="static")
