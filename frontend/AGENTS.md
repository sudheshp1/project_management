# Frontend guide

## Purpose

This directory contains the current Kanban Studio frontend demo. It is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS 4, and `@dnd-kit` for card drag-and-drop. It is exported as static files served by the FastAPI backend. Board data is loaded from and saved to the backend API.

## Structure

- `src/app/` contains the App Router layout, root page, and global styles.
- `src/components/` contains the board and its column, card, preview, and new-card form components.
- `src/lib/kanban.ts` owns board types, demo data, ID generation, and card-movement logic.
- `src/test/setup.ts` configures the Vitest DOM environment.
- `tests/` contains Playwright browser tests.

## Current behavior

`KanbanBoard` renders five seeded columns. Users can rename a column, add and delete cards, reorder cards, and drag a card between columns. `KanbanBoard` loads the board from `GET /api/board` (with loading and retry states) and saves every change through `src/lib/api.ts`; each API call returns the full board, which replaces local state. Drags, deletes, and renames update the UI optimistically and roll back with an error message if the save fails. Column titles save on blur or Enter. A 401 from the board API returns the user to the login form. `ChatSidebar` (rendered beside the board from the `2xl` breakpoint, below it on narrower screens) keeps the conversation in component state, sends it with each message to `POST /api/chat`, shows sending and error states, and replaces the board with the one returned so AI changes appear immediately. `src/app/page.tsx` checks `/api/me` on load and shows `LoginForm` until the user signs in; `src/lib/auth.ts` wraps the auth API calls. In `next dev`, `next.config.ts` proxies `/api/*` to the backend on port 8000 (or `BACKEND_URL`).

Use the existing CSS custom properties in `src/app/globals.css` for the project colors. Keep components accessible and preserve the existing test IDs and accessible names when changing interactive behavior.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run test:unit
npm run test:e2e
npm run test:all
```

Vitest tests files under `src/**/*.{test,spec}.{ts,tsx}` with jsdom. Unit tests mock the backend with `src/test/mockApi.ts`. Playwright tests run in Chromium and start their own backend on port 8001 with a fresh `backend/data/e2e.db` (`uv` must be on PATH) a fake OpenRouter (`tests/mock-openrouter.mjs`, port 8002, wired in through `OPENROUTER_URL`), and a Next development server on port 3001, so they never touch a running app, real data, or the real AI service.

## Testing requirements

- Add unit tests for changed library logic and component behavior.
- Add Playwright coverage for user-visible workflows spanning the frontend and backend.
- Maintain at least 80% line, function, branch, and statement unit-test coverage for application code; configure enforcement when adding the coverage gate.
- Run the smallest relevant tests, then lint and build for applicable changes.

## Planned integration

The FastAPI backend will eventually serve a static frontend build. Keep browser-only behavior isolated from API and board state logic so the in-memory board can be replaced cleanly with authenticated backend data.
