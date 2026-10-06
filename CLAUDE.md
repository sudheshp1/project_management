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
npm run dev                                  # Next dev server on :3000
npm run lint
npm run build                                # static export to frontend/out
npm run test:unit                            # Vitest (jsdom), src/**/*.test.ts(x)
npx vitest run src/lib/kanban.test.ts        # single test file
npx vitest run -t "test name"                # single test by name
npm run test:coverage
npm run test:e2e                             # Playwright (Chromium); auto-starts dev server
npx playwright test tests/kanban.spec.ts -g "name"
```

Backend (run in `backend/`):

```bash
uv sync --all-groups
uv run pytest
uv run pytest tests/test_main.py::test_health_returns_ok
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`app/main.py` mounts `backend/static/` at `/`, so that directory must exist for the app (and tests) to import. In the container it holds the frontend build.

## Architecture

- Single Docker image built in two stages (`Dockerfile`): Node builds the Next.js app as a static export (`output: "export"` in `next.config.ts`, emitted to `frontend/out`), then a `uv` Python image copies it to `/app/static` and runs FastAPI via uvicorn on port 8000.
- FastAPI (`backend/app/main.py`) serves API routes under `/api/` and mounts the static frontend at `/` last. All new API routes must stay under `/api/` and be registered before the static mount so they are not shadowed.
- The frontend is a static client-side app: no Next.js server features (API routes, SSR, server actions) are available at runtime, since only the exported files are served. It must talk to the backend via `/api/*` fetches.
- Frontend state currently lives in React state inside `KanbanBoard`, seeded from `initialData` in `src/lib/kanban.ts`. `kanban.ts` owns the `BoardData` shape (`columns` with ordered `cardIds`, plus a `cards` map) and the pure card-move logic; keep board logic there, separate from components, so it can be swapped for backend data.
- Planned (see `docs/PLAN.md`): hardcoded `user`/`password` sign-in, SQLite persistence (auto-created, multi-user schema, one board per user), and an AI chat sidebar that calls OpenRouter (`openai/gpt-oss-120b`) server-side with `OPENROUTER_API_KEY` from the root `.env`, returning structured output that can create/edit/move cards.

## Conventions

- Use the color CSS custom properties in `frontend/src/app/globals.css` (project palette is in `AGENTS.md`).
- Preserve existing `data-testid`s and accessible names; unit and Playwright tests depend on them.
- Mock OpenRouter in automated tests; keep credentials server-side only.
