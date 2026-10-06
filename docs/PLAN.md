# Project implementation plan

## Quality gates

- [ ] Add focused unit tests for changed logic and integration tests for API, database, auth, static serving, and frontend-to-backend workflows.
- [ ] Use coverage reports only when they help identify untested critical behavior; do not add tests solely to meet a coverage percentage.
- [ ] Run linting, unit tests with coverage, integration tests, and a production build before completing each applicable part.
- [ ] Mock OpenRouter in automated tests. Run a live connectivity check only when `OPENROUTER_API_KEY` is configured locally.

## Part 1: Planning and frontend documentation

### Checklist

- [x] Inspect the existing frontend structure, dependencies, UI behavior, and test setup.
- [x] Create `frontend/AGENTS.md` with architecture, conventions, commands, and feature boundaries.
- [x] Expand this plan into implementation checklists, validation steps, and success criteria.
- [ ] Obtain explicit user approval before beginning scaffolding.

### Tests and success criteria

- No application behavior changes are made.
- Frontend documentation accurately reflects the existing Next.js application and test commands.
- The user approves this plan before Part 2 begins.

## Part 2: Docker, backend, and scripts (Complete)

### Checklist

- [x] Add a FastAPI backend under `backend/`, managed with `uv` in the container.
- [x] Add Docker configuration packaging the backend and static assets.
- [x] Add Windows, macOS, and Linux start/stop scripts under `scripts/`.
- [x] Serve a temporary static hello-world page at `/`.
- [x] Add an API health endpoint and call it from the temporary page.
- [x] Document required environment variables without exposing values.

### Tests and success criteria

- Unit-test the health endpoint.
- Integration-test the container: it starts locally, `GET /` returns the page, and the page calls the API.
- Scripts work on their target platforms.

## Part 3: Static frontend delivery (Complete)

### Checklist

- [x] Configure a reproducible static Next.js build.
- [x] Include the built frontend in the backend container image.
- [x] Configure FastAPI to serve the frontend from `/` while preserving API routes.
- [x] Replace the temporary page with the current Kanban board.
- [x] Preserve five columns, rename, create, delete, reorder, and cross-column drag-and-drop.

### Tests and success criteria

- Unit-test Kanban state operations and interactive components.
- Browser integration-test rendering, adding/removing cards, renaming, and drag-and-drop.
- Integration-test the production container serving the board at `/`.
- Focused unit and browser integration tests cover the shipped Kanban interactions.

## Part 4: MVP sign-in (Complete)

### Checklist

- [x] Require login before board access.
- [x] Validate only `user` / `password`.
- [x] Persist local authenticated state, protect board API routes, and implement logout.
- [x] Prevent unauthenticated access to board UI and data.

### Tests and success criteria

- Unit-test credential validation and auth state behavior.
- Integration-test failed and successful login, protected access, refresh, and logout.
- Authentication success, failure, session restoration, and logout are covered by focused tests.

## Part 5: Database design approval (Complete)

### Checklist

- [x] Propose a SQLite schema for users, one board per user, fixed columns, cards, and ordering.
- [x] Save the proposed schema as JSON in `docs/`.
- [x] Document initialization, ownership boundaries, and migrations in `docs/`.
- [x] Obtain user approval before implementing persistence.

### Tests and success criteria

- Validate the JSON schema is complete and internally consistent.
- Do not start persistence implementation until the schema is approved.

## Part 6: Persistent backend API (Complete)

### Checklist

- [x] Create SQLite automatically when absent.
- [x] Implement authenticated routes to read and mutate a user's board.
- [x] Support column renames, card create/edit/delete, movement, and ordering.
- [x] Reject malformed input and cross-user access.
- [x] Separate database access and API schemas from route handlers.

### Tests and success criteria

- Unit-test database operations and business logic.
- Integration-test a fresh database, CRUD, ordering, validation failures, auth, and user isolation.
- Focused backend unit and integration tests cover the supported board operations.

## Part 7: Persistent frontend integration (Complete)

### Checklist

- [x] Replace in-memory state with the authenticated backend API.
- [x] Add loading and error states.
- [x] Persist all board mutations through the API.
- [x] Preserve updates after browser refresh.

### Tests and success criteria

- Unit-test the API client, state transitions, loading, and errors.
- Browser integration-test login, persistent mutation, refresh, and logout against the running backend.
- Focused frontend unit and browser integration tests cover persistence, loading, and error behavior.

## Part 8: OpenRouter connectivity (Complete)

### Checklist

- [x] Add a server-side OpenRouter client configured from `OPENROUTER_API_KEY`.
- [x] Use `openai/gpt-oss-120b`.
- [x] Keep the key out of source control, logs, and responses.
- [x] Add a scoped live `2+2` connectivity check for configured local environments.

### Tests and success criteria

- Unit-test request construction and response parsing with mocked HTTP.
- Integration-test missing-key and upstream-error behavior with mocks.
- The explicit configured live check correctly answers `2+2`.

## Part 9: Structured AI board operations

### Checklist

- [ ] Send board JSON, conversation history, and the new prompt to the AI service.
- [ ] Define and validate structured output containing a reply and optional board update.
- [ ] Apply only valid updates to the authenticated user's board.
- [ ] Persist successful AI updates and return the updated board.

### Tests and success criteria

- Unit-test structured-output validation and update application.
- Integration-test chat-only replies, valid updates, invalid output, persistence, and isolation.
- Focused backend unit and integration tests cover structured response validation and persistence.

## Part 10: AI chat sidebar

### Checklist

- [ ] Add a responsive, accessible chat sidebar using the established color scheme.
- [ ] Display history, sending state, errors, and model replies.
- [ ] Send prompts to the authenticated backend API.
- [ ] Refresh the visible board automatically after AI changes.
- [ ] Preserve existing board interactions.

### Tests and success criteria

- Unit-test chat state and rendering.
- Browser integration-test chat-only replies, AI card changes and moves, errors, and automatic refresh.
- Run the complete lint, unit coverage, integration, and production-build suite successfully.
