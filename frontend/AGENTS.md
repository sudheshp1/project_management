# Frontend guide

## Purpose

This directory contains the current Kanban Studio frontend demo. It is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS 4, and `@dnd-kit` for card drag-and-drop. It is exported as static files served by the FastAPI backend. Board data starts from `initialData` and mutations live in React component state.

## Structure

- `src/app/` contains the App Router layout, root page, and global styles.
- `src/components/` contains the board and its column, card, preview, and new-card form components.
- `src/lib/kanban.ts` owns board types, demo data, ID generation, and card-movement logic.
- `src/test/setup.ts` configures the Vitest DOM environment.
- `tests/` contains Playwright browser tests.

## Current behavior

`KanbanBoard` renders five seeded columns. Users can rename a column, add and delete cards, reorder cards, and drag a card between columns. Component state is not persistent. `src/app/page.tsx` checks `/api/me` on load and shows `LoginForm` until the user signs in; `src/lib/auth.ts` wraps the auth API calls. In `next dev`, `next.config.ts` proxies `/api/*` to the backend on port 8000.

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

Vitest tests files under `src/**/*.{test,spec}.{ts,tsx}` with jsdom. Playwright tests run in Chromium and start both the backend (`uv run uvicorn` in `../backend`, so `uv` must be on PATH) and the Next development server automatically.

## Testing requirements

- Add unit tests for changed library logic and component behavior.
- Add Playwright coverage for user-visible workflows spanning the frontend and backend.
- Maintain at least 80% line, function, branch, and statement unit-test coverage for application code; configure enforcement when adding the coverage gate.
- Run the smallest relevant tests, then lint and build for applicable changes.

## Planned integration

The FastAPI backend will eventually serve a static frontend build. Keep browser-only behavior isolated from API and board state logic so the in-memory board can be replaced cleanly with authenticated backend data.
