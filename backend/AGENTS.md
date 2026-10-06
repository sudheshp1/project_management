# Backend guide

This directory contains the FastAPI application and its tests. The container serves the exported frontend build from `static/` and exposes `GET /api/health`.

Authentication lives in `app/auth.py`: `POST /api/login` validates the hardcoded `user` / `password` and sets an HttpOnly `session` cookie backed by an in-memory session store (sessions reset on restart), `POST /api/logout` ends it, and `GET /api/me` returns the signed-in user. Protect routes with `Depends(current_user)`.

## Commands

```bash
uv sync --all-groups
uv run pytest
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Keep API routes below `/api/` so the root static mount can serve frontend assets. Add unit tests in `tests/` for every route and business-logic change. Future database, authentication, and AI integrations must keep credentials server-side.