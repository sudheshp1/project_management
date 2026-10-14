# Code review

Date: 2026-10-14. Scope: the full repository at commit `dc6a6f4` (Parts 1-10), covering `backend/app`, `frontend/src`, the Dockerfile, Compose, and scripts. Findings are ordered by severity. Each one cites the code it is based on.

## Summary

The codebase is small, consistent, and easy to follow. Board logic is kept out of the components, AI operations are validated before anything is applied, the API key stays server-side, and test coverage is broad. The main problems are a chat limit that breaks long conversations, AI operations that are not applied atomically, and one race condition on first login.

## High

### 1. Chat stops working after 25 exchanges

- `frontend/src/components/ChatSidebar.tsx:31-37` sends the full `messages` array as `history` on every request and never trims it.
- `backend/app/schemas.py:56` caps `history` at `max_length=50`. Each message is also capped at 10000 characters (`schemas.py:52`), and nothing limits the length of the AI's reply.
- What happens: after 25 user/assistant exchanges, the 26th request sends 52 history items and gets a 422. The catch block (`ChatSidebar.tsx:45-47`) puts the history back as it was, so every later attempt fails the same way until the page is reloaded. The same thing happens as soon as any single assistant reply goes over 10000 characters.
- Fix: send only the most recent N messages (for example `history.slice(-40)`) and truncate the content of each message on the client, or trim on the server instead of rejecting the request. Add a test that sends more than 50 messages through the sidebar.

## Medium

### 2. AI operations are not applied atomically

- `backend/app/chat.py:111-118` calls `db.create_card`, `db.update_card`, and `db.move_card` in a loop. Each of those opens its own `with conn:` block (`db.py:195`, `208`, `229`), which commits on exit.
- `parse_response` validates every operation against the board before any are applied, which covers most failures. But if one operation fails partway through (for example, the user deletes a card between validation and application), the earlier operations stay committed. The user then gets a 404 and a board that is half changed. This contradicts the design statement that operations are validated "before applying any".
- Fix: run the whole loop inside a single transaction, either with one `with conn:` around `apply_operations` and the db helpers no longer committing on their own, or with an explicit `BEGIN`/`COMMIT` in `chat()`.

### 3. Race when a board is created on first access

- `backend/app/db.py:103-124`: `board_id_for` does a `SELECT`, then (if nothing is found) inserts the user and the board. The `SELECT` runs outside the transaction.
- If two requests for a new user arrive at the same time, both can see no board. The second then fails on `boards.user_id UNIQUE` with an unhandled `IntegrityError`, which returns a 500. React StrictMode (the default in `next dev`) runs the board-loading effect in `KanbanBoard.tsx:44-52` twice, so a fresh database in development makes this likely. The user then sees "Could not load your board."
- Fix: insert the board with `INSERT OR IGNORE`, or catch `sqlite3.IntegrityError` and select again. Start the transaction before the existence check.

### 4. Read-then-write ordering in `move_card` and `delete_card`

- `backend/app/db.py:229-235` and `216-219` read the card order with `_card_ids` and then write positions back. Python's `sqlite3` only starts a transaction on the first write, so the read happens without a lock.
- Two moves running at the same time in the same column (two tabs, or a manual drag during an AI update) can leave duplicate or skipped positions. Nothing crashes, because `cards.position` has no unique constraint, but the order can come out wrong.
- Fix: run `BEGIN IMMEDIATE` before the read, or set `isolation_level=None` and manage transactions explicitly.

### 5. The container likely installs dev dependencies at startup

- `Dockerfile:16` runs `uv sync --no-dev`, but the `CMD` on line 23 is `uv run uvicorn ...`. `uv run` syncs the environment before running, and by default that includes the `dev` group (`pytest`, `pyproject.toml:12-15`).
- This was inferred from uv's default behaviour, not watched in a container log. If it is right, every container start needs network access and installs pytest into the runtime environment.
- Fix: `CMD ["uv", "run", "--no-dev", "uvicorn", ...]`, or run `/app/.venv/bin/uvicorn` directly. Confirm with `docker compose logs app` on a fresh start.

## Low

### 6. Placeholder text is saved as real card data

- `frontend/src/components/KanbanBoard.tsx:137` sends `"No details yet."` when the details field is empty. That string is stored in the database and sent to the AI as card content. Cards the AI creates get `""` instead (`chat.py:114`), so there are two different representations of "no details".
- Fix: store `""` and show the placeholder at render time in `KanbanCard`.

### 7. Inputs have no client-side length limits

- The column title input (`KanbanColumn.tsx:59-70`) and the new-card title and details inputs (`NewCardForm.tsx:27-44`) have no `maxLength`, while the server enforces 200 and 5000 characters (`schemas.py:6`, `37`). Input that is too long gets a 422, a rollback, and a generic "Could not save" message.
- Fix: add `maxLength={200}` and `maxLength={5000}`, as `ChatSidebar` already does for messages.

### 8. Out-of-order save responses can briefly overwrite newer state

- `KanbanBoard.tsx:84-100`: each `save` replaces the board with its own response and rolls back to the `previous` captured in its closure. If two changes are in flight, a slower earlier response can replace the result of a later change until the next save, and a failed save can roll back to a snapshot that predates a change that succeeded.
- This is acceptable for a single-user MVP. Note it if the app ever supports multiple users or tabs.

### 9. Blank screen if `/api/me` cannot be reached

- `frontend/src/app/page.tsx:11-13`: if `fetch` rejects (backend down, network error), `getCurrentUser` throws, `user` stays `undefined`, and the page renders `null` with no message.
- Fix: catch the error and fall back to `null` (which shows the login form) or show an error state.

### 10. Sessions never expire

- `backend/app/auth.py:10` keeps sessions in memory with no expiry, and every login adds an entry. The cookie has no `max_age` or `secure` flag (`main.py:64`). This is acceptable for the hardcoded MVP login and localhost, but it should be revisited before any real deployment.

### 11. Drag and drop has no keyboard support

- `KanbanBoard.tsx:38-42` registers only `PointerSensor`. Cards get `role="button"` and a tab stop from `useSortable`, but keyboard users cannot move them.
- Fix: add `useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })`.

## Housekeeping

- `frontend/test-results/.last-run.json` has been tracked since the initial commit. It is a Playwright output file. Remove it from git and add `test-results/` to `frontend/.gitignore`.
- `initialData` in `frontend/src/lib/kanban.ts:18-72` is now used only by tests (`api.test.ts`, `test/mockApi.ts`). It could move to `src/test/` to keep it out of the production bundle.
- The container runs as root. This is fine for local use, but consider adding a `USER` line to the Dockerfile.

## What is working well

- Clear split between the pure board logic (`lib/kanban.ts`) and the components, and between the database helpers and the routes.
- AI output goes through a strict JSON schema and is then validated against the user's board on the server, so the model's output is never trusted on its own.
- AI errors are mapped to 502/503 and never include the API key. `OPENROUTER_URL` makes end-to-end tests possible without network calls.
- Every route queries by `board_id`, so a user cannot read or change cards on another user's board.
- `SameSite=Strict` HttpOnly cookies give reasonable CSRF protection for the MVP.

## Suggested order

1. Trim the chat history (finding 1).
2. Make AI operations one transaction and fix the first-access race (findings 2 and 3).
3. Fix the Docker `CMD` (finding 5), after confirming it in the container logs.
4. Pick from the low-severity items as time allows.
