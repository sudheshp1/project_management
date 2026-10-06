import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page, password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test("requires sign-in before showing the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("rejects invalid credentials", async ({ page }) => {
  await signIn(page, "wrong");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Invalid username or password.");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("keeps the session across refresh and logs out", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("persists board changes across refresh and sign-in", async ({ page }) => {
  await signIn(page);
  const discovery = page.getByTestId("column-col-discovery");
  const title = discovery.getByLabel("Column title");
  await title.fill("Research");
  await title.press("Enter");
  await discovery.getByRole("button", { name: /add a card/i }).click();
  await discovery.getByPlaceholder("Card title").fill("Persisted card");
  await discovery.getByRole("button", { name: /add card/i }).click();
  await expect(discovery.getByText("Persisted card")).toBeVisible();
  await discovery.getByRole("button", { name: "Delete Prototype analytics view", exact: true }).click();
  await expect(discovery.getByText("Prototype analytics view")).toHaveCount(0);

  await page.reload();
  await expect(title).toHaveValue("Research");
  await expect(discovery.getByText("Persisted card")).toBeVisible();
  await expect(discovery.getByText("Prototype analytics view")).toHaveCount(0);

  await page.getByRole("button", { name: "Log out" }).click();
  await signIn(page);
  await expect(title).toHaveValue("Research");
  await expect(discovery.getByText("Persisted card")).toBeVisible();
});

test("persists a dragged card after refresh", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-2");
  const targetColumn = page.getByTestId("column-col-done");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + columnBox.height - 40, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-2")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("column-col-done").getByTestId("card-card-2")).toBeVisible();
});

const chat = async (page: Page, message: string) => {
  const sidebar = page.getByRole("complementary", { name: "AI assistant" });
  await sidebar.getByLabel("Message").fill(message);
  await sidebar.getByRole("button", { name: "Send" }).click();
  return sidebar;
};

test("chat shows a reply without changing the board", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  const cardCount = await page.locator('[data-testid^="card-"]').count();

  const sidebar = await chat(page, "Hello there");

  await expect(sidebar.getByRole("log")).toContainText("Hello there");
  await expect(sidebar.getByRole("log")).toContainText("Hello from the mock assistant.");
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(cardCount);
});

test("AI changes refresh the board and persist", async ({ page }) => {
  await signIn(page);

  const sidebar = await chat(page, "Please add a card");
  await expect(sidebar.getByRole("log")).toContainText("Added an AI card to Review.");
  await expect(page.getByTestId("column-col-review").getByText("AI card")).toBeVisible();

  await chat(page, "Now move the roadmap card");
  await expect(sidebar.getByRole("log")).toContainText("Moved the roadmap card to Done.");
  const done = page.getByTestId("column-col-done");
  await expect(done.locator('[data-testid^="card-"]').first()).toHaveAttribute("data-testid", "card-card-1");

  await page.reload();
  await expect(page.getByTestId("column-col-review").getByText("AI card")).toBeVisible();
  await expect(done.locator('[data-testid^="card-"]').first()).toHaveAttribute("data-testid", "card-card-1");
});

test("chat shows an error when the AI fails", async ({ page }) => {
  await signIn(page);

  const sidebar = await chat(page, "Please fail");

  await expect(sidebar.getByRole("alert")).toHaveText("The assistant could not respond. Please try again.");
  await expect(sidebar.getByLabel("Message")).toHaveValue("Please fail");
});

test("shows the chat beside the board on wide screens", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await signIn(page);
  const board = await page.getByTestId("column-col-done").boundingBox();
  const sidebar = await page.getByRole("complementary", { name: "AI assistant" }).boundingBox();
  if (!board || !sidebar) {
    throw new Error("Unable to resolve layout.");
  }
  expect(sidebar.x).toBeGreaterThan(board.x + board.width);
  expect(board.width).toBeGreaterThan(200);
});
