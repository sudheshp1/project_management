import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  // Dedicated ports, a fresh database, and a fake OpenRouter so tests never touch a running app,
  // real data, or the real AI service.
  webServer: [
    {
      command: "node tests/mock-openrouter.mjs",
      url: "http://127.0.0.1:8002/",
      timeout: 120_000,
    },
    {
      command:
        "uv run python -c \"from pathlib import Path; Path('data/e2e.db').unlink(missing_ok=True)\" && uv run uvicorn app.main:app --host 127.0.0.1 --port 8001",
      cwd: "../backend",
      env: {
        DATABASE_PATH: "data/e2e.db",
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_URL: "http://127.0.0.1:8002/",
      },
      url: "http://127.0.0.1:8001/api/health",
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
      env: { BACKEND_URL: "http://127.0.0.1:8001" },
      url: "http://127.0.0.1:3001",
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
