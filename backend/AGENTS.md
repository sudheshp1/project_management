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

## Commands

```bash
uv sync --all-groups
uv run pytest
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Keep API routes below `/api/` so the root static mount can serve frontend assets. Add unit tests in `tests/` for every route and business-logic change. Future database, authentication, and AI integrations must keep credentials server-side.