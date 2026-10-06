# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

- `AGENTS.md` (root) holds the business requirements, technical decisions, color scheme, and coding standards. Follow it.
- `docs/PLAN.md` is the phased implementation plan with checklists. Review it before starting work, work only on the current part, and tick items off as they are completed. Parts 1 and 5 require explicit user approval before moving on.
- `frontend/AGENTS.md`, `backend/AGENTS.md`, and `scripts/AGENTS.md` hold directory-specific guidance.

Key standards from `AGENTS.md`: keep it simple, no over-engineering or unnecessary defensive code, no extra features, minimal README, never use emojis, and identify the root cause with evidence before fixing any issue.

## Commands

Run the whole app (Docker, served at http://localhost:8000):

```bash
docker compose up --build -d     # or scripts/start-<windows|macos|linux>
docker compose down              # or scripts/stop-<platform>
```

Frontend (run in `frontend/`):

```bash
npm run dev                                  # Next dev server on :3000, proxies /api to :8000
npm run lint
npm run build                                # static export to frontend/out
npm run test:unit                            # Vitest (jsdom), src/**/*.test.ts(x)
npx vitest run src/lib/kanban.test.ts        # single test file
npx vitest run -t "test name"                # single test by name
npm run test:coverage
npm run test:e2e                             # Playwright (Chromium); starts its own backend (:8001, fresh e2e.db) and dev server (:3001)
npx playwright test tests/kanban.spec.ts -g "name"
```

Backend (run in `backend/`):

```bash
uv sync --all-groups
uv run pytest
uv run pytest tests/test_main.py::test_health_returns_ok
uv run --env-file ../.env pytest -m live      # live OpenRouter check (deselected by default)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`app/main.py` mounts `backend/static/` at `/`; in the container it holds the frontend build. Locally it may be empty, so use `npm run dev` on :3000 for the UI.

## Architecture

- Single Docker image built in two stages (`Dockerfile`): Node builds the Next.js app as a static export (`output: "export"` in `next.config.ts`, emitted to `frontend/out`), then a `uv` Python image copies it to `/app/static` and runs FastAPI via uvicorn on port 8000.
- FastAPI (`backend/app/main.py`) serves API routes under `/api/` and mounts the static frontend at `/` last. All new API routes must stay under `/api/` and be registered before the static mount so they are not shadowed.
- Auth: hardcoded `user` / `password`, an HttpOnly `session` cookie, and an in-memory session store in `backend/app/auth.py`. Protect API routes with `Depends(current_user)`. The frontend checks `/api/me` on load and shows the login form when it returns 401.
- The frontend is a static client-side app: no Next.js server features (API routes, SSR, server actions) are available at runtime, since only the exported files are served. It must talk to the backend via `/api/*` fetches; during `next dev`, `next.config.ts` proxies `/api/*` to the backend on :8000.
- `KanbanBoard` loads the board from the API and saves every mutation through `src/lib/api.ts`; each call returns the full board, which replaces local state (optimistic updates roll back on failure). `src/lib/kanban.ts` owns the `BoardData` shape (`columns` with ordered `cardIds`, plus a `cards` map) and the pure card-move logic; keep board logic there, separate from components.
- Persistence: SQLite in `backend/app/db.py` (schema and design in `docs/database-schema.json` and `docs/DATABASE.md`), created on startup at `backend/data/app.db` (`/app/data` is a named volume in Docker). Board routes under `/api/board`, `/api/columns`, `/api/cards` return the full board in the frontend `BoardData` shape; route list in `backend/AGENTS.md`.
- AI: `backend/app/ai.py` calls OpenRouter (`openai/gpt-oss-120b`) server-side with `OPENROUTER_API_KEY` from the root `.env` (passed to the container via `env_file` in `compose.yaml`; never baked into the image).
- Planned (see `docs/PLAN.md`): a chat endpoint returning structured output that can create/edit/move cards, and an AI chat sidebar.

## Conventions

- Use the color CSS custom properties in `frontend/src/app/globals.css` (project palette is in `AGENTS.md`).
- Preserve existing `data-testid`s and accessible names; unit and Playwright tests depend on them.
- Mock OpenRouter in automated tests; keep credentials server-side only.
