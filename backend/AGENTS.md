# Backend guide

This directory contains the FastAPI application and its tests. The container serves the exported frontend build from `static/` and exposes `GET /api/health`.

## Commands

```bash
uv sync --all-groups
uv run pytest
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Keep API routes below `/api/` so the root static mount can serve frontend assets. Add unit tests in `tests/` for every route and business-logic change. Future database, authentication, and AI integrations must keep credentials server-side.