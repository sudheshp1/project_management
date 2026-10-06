# Backend guide

This directory contains the FastAPI application and its tests. The container serves the exported frontend build from `static/` and exposes `GET /api/health`.

Authentication lives in `app/auth.py`: `POST /api/login` validates the hardcoded `user` / `password` and sets an HttpOnly `session` cookie backed by an in-memory session store (sessions reset on restart), `POST /api/logout` ends it, and `GET /api/me` returns the signed-in user. Protect routes with `Depends(current_user)`.

Persistence lives in `app/db.py` (SQLite via the standard library; schema in `docs/database-schema.json`, design in `docs/DATABASE.md`). The database is created on startup at `data/app.db` or `DATABASE_PATH`, and a user's seeded board is created on first access. API request and response models live in `app/schemas.py` (camelCase JSON matching the frontend `BoardData` shape). Board routes, all of which return the full board:

- `GET /api/board`
- `PATCH /api/columns/{column_id}` with `{title}`
- `POST /api/cards` with `{columnId, title, details?}`
- `PATCH /api/cards/{card_id}` with `{title?, details?}`
- `DELETE /api/cards/{card_id}`
- `POST /api/cards/{card_id}/move` with `{columnId, position}`

Unknown ids and other users' cards return 404. Tests get a fresh database per test through the fixtures in `tests/conftest.py`.

The OpenRouter client is `app/ai.py`: `complete(messages, response_format=None)` calls `openai/gpt-oss-120b` with `OPENROUTER_API_KEY` from the environment and returns the reply text. It raises `AINotConfigured` when the key is missing and `AIError` for upstream, network, or malformed-response failures; error messages never include the key. Docker Compose passes the root `.env` to the container; locally use `uv run --env-file ../.env ...`. Unit tests mock HTTP with `httpx.MockTransport` (the `transport` argument). The live checks in `tests/test_ai_live.py` are deselected by default.

AI chat lives in `app/chat.py`, exposed as `POST /api/chat` with `{history: [{role, content}], message}` (history is held by the client; roles are `user` or `assistant`). It sends the system prompt with the board JSON, the history, and the message, requesting the strict JSON schema in `RESPONSE_FORMAT`: `{reply, operations}`, where each operation is `create`, `update`, or `move` with all fields present (null when unused). Every operation is validated against the signed-in user's board before any is applied; one invalid operation rejects the whole response. Returns `{reply, board}`. Errors: 503 when the key is missing, 502 for upstream failures or invalid model output. Tests replace `ai.complete` with a fake. `OPENROUTER_URL` overrides the endpoint; Playwright uses it to point at a fake server.

## Commands

```bash
uv sync --all-groups
uv run pytest
uv run --env-file ../.env pytest -m live   # live OpenRouter 2+2 check
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Keep API routes below `/api/` so the root static mount can serve frontend assets. Add unit tests in `tests/` for every route and business-logic change. Future database, authentication, and AI integrations must keep credentials server-side.