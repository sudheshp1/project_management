# Database design

The proposed schema is in `database-schema.json`. This document covers how it is created, who owns what, and how it changes over time.

## Tables

- `users`: one row per username. There is no password column; the MVP checks the hardcoded `user` / `password` in `app/auth.py`.
- `boards`: one board per user, enforced by a unique `user_id`.
- `columns`: the five fixed columns of a board. Each has a stable `key` (for example `col-review`) used as its API id, an editable `title`, and a `position`.
- `cards`: belong to a column, with `title`, `details`, and a `position` within the column.

## API ids

The frontend tells columns and cards apart by id, so they must never collide. Columns use their `key` (`col-review`); cards use `card-<id>` (`card-12`). This matches the current frontend data shape, so components and tests keep working.

## Ordering

Card `position` is 0-based and contiguous within a column. A move or delete rewrites the positions of the affected column(s) inside one transaction. Columns are never added, removed, or reordered, so their positions are fixed at creation.

## Initialization

- The database file is `data/app.db` under the backend directory (`/app/data/app.db` in the container), overridable with the `DATABASE_PATH` environment variable.
- On startup the backend creates the directory and file if missing, enables `PRAGMA foreign_keys = ON` on every connection, and creates the tables if they do not exist.
- On first sign-in, the backend creates the user row if missing. When the user has no board, it creates the board, the five seed columns, and the sample cards from `initialData` in one transaction.
- `docker compose` mounts a named volume at `/app/data` so the board survives container rebuilds. `data/` is git-ignored.

## Ownership boundaries

- Every board query starts from the signed-in username, resolved to `users.id`, then `boards.user_id`.
- Column and card lookups join back to the board and filter by that user, so a request for another user's column or card returns 404, never the data.
- Deleting a user cascades to the board, columns, and cards.

## Migrations

- The schema version is stored in `PRAGMA user_version`. Version 1 is this schema.
- Future changes are numbered SQL steps in the backend, applied in order on startup for each version above the stored one, then `user_version` is updated. Each step runs in a transaction.
- No migration tool is used for the MVP.
