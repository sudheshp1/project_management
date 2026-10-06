import json
import sqlite3
from typing import Literal

from pydantic import BaseModel, ValidationError

from app import ai, db
from app.schemas import ApiModel, ChatMessage

SYSTEM_PROMPT = """You are the assistant inside a Kanban project management app. \
You help the user plan and manage their board, and you can create, edit, and move cards.

The board has fixed columns. You cannot add, remove, or rename columns, and you cannot delete cards.

Always respond with JSON containing:
- "reply": your message to the user.
- "operations": the board changes to make, in order. Use an empty list when no change is needed.

Each operation has every field below; set fields you do not use to null.
- "type": "create", "update", or "move".
- "cardId": the id of an existing card (update, move).
- "columnId": the id of a column (create, move).
- "title": the card title (required for create; for update, null keeps the current title).
- "details": the card details (create; for update, null keeps the current details).
- "position": 0-based index in the target column, counted after the card is removed (move); null puts it at the end.

Only use card and column ids that appear in the board below. Cards you create in this response \
cannot be referenced by later operations in the same response.

Current board (JSON):
{board}"""

OPERATION_FIELDS = ["type", "cardId", "columnId", "title", "details", "position"]

RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "board_assistant_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["reply", "operations"],
            "properties": {
                "reply": {"type": "string"},
                "operations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": OPERATION_FIELDS,
                        "properties": {
                            "type": {"type": "string", "enum": ["create", "update", "move"]},
                            "cardId": {"type": ["string", "null"]},
                            "columnId": {"type": ["string", "null"]},
                            "title": {"type": ["string", "null"]},
                            "details": {"type": ["string", "null"]},
                            "position": {"type": ["integer", "null"]},
                        },
                    },
                },
            },
        },
    },
}


class InvalidAIResponse(ai.AIError):
    pass


class Operation(ApiModel):
    type: Literal["create", "update", "move"]
    card_id: str | None = None
    column_id: str | None = None
    title: str | None = None
    details: str | None = None
    position: int | None = None


class AIResponse(BaseModel):
    reply: str
    operations: list[Operation]


def parse_response(content: str, board: dict) -> AIResponse:
    """Parse the model output and check every operation against the current board."""
    try:
        response = AIResponse.model_validate_json(content)
    except ValidationError:
        raise InvalidAIResponse("AI returned an invalid response") from None

    columns = {column["id"] for column in board["columns"]}
    cards = set(board["cards"])
    for op in response.operations:
        if op.title is not None and not 1 <= len(op.title) <= 200:
            raise InvalidAIResponse("AI returned an invalid card title")
        if op.details is not None and len(op.details) > 5000:
            raise InvalidAIResponse("AI returned card details that are too long")
        valid = {
            "create": op.column_id in columns and op.title is not None,
            "update": op.card_id in cards and (op.title is not None or op.details is not None),
            "move": op.card_id in cards and op.column_id in columns
            and (op.position is None or op.position >= 0),
        }[op.type]
        if not valid:
            raise InvalidAIResponse(f"AI returned an invalid {op.type} operation")
    return response


def apply_operations(conn: sqlite3.Connection, board_id: int, operations: list[Operation]) -> None:
    for op in operations:
        if op.type == "create":
            db.create_card(conn, board_id, op.column_id, op.title, op.details or "")
        elif op.type == "update":
            db.update_card(conn, board_id, op.card_id, op.title, op.details)
        else:
            db.move_card(conn, board_id, op.card_id, op.column_id, op.position)


def chat(conn: sqlite3.Connection, board_id: int, history: list[ChatMessage], message: str) -> dict:
    board = db.get_board(conn, board_id)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(board=json.dumps(board))},
        *({"role": m.role, "content": m.content} for m in history),
        {"role": "user", "content": message},
    ]
    response = parse_response(ai.complete(messages, response_format=RESPONSE_FORMAT), board)
    apply_operations(conn, board_id, response.operations)
    return {"reply": response.reply, "board": db.get_board(conn, board_id)}
