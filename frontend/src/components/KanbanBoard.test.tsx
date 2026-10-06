import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { mockApi } from "@/test/mockApi";

const renderBoard = async (onLogout = () => {}) => {
  render(<KanbanBoard onLogout={onLogout} />);
  await screen.findByRole("heading", { name: "Kanban Studio" });
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const addCard = async (column: HTMLElement, title: string, details = "") => {
  const user = userEvent.setup();
  await user.click(within(column).getByRole("button", { name: /add a card/i }));
  await user.type(within(column).getByPlaceholderText(/card title/i), title);
  if (details) {
    await user.type(within(column).getByPlaceholderText(/details/i), details);
  }
  await user.click(within(column).getByRole("button", { name: /add card/i }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KanbanBoard", () => {
  it("shows a loading state, then the board from the API", async () => {
    const { fetchMock } = mockApi();
    render(<KanbanBoard onLogout={() => {}} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading board...");
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith("/api/board", expect.anything());
  });

  it("shows a load error and retries", async () => {
    const { state } = mockApi({ failBoard: true });
    render(<KanbanBoard onLogout={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your board.");

    state.failBoard = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("returns to sign-in when the session has expired", async () => {
    mockApi({ signedIn: false });
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("saves a column rename on blur", async () => {
    const { fetchMock, state } = mockApi();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.type(input, "New Name{Enter}");

    expect(input).toHaveValue("New Name");

    await waitFor(() => expect(state.board.columns[0].title).toBe("New Name"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/columns/col-backlog",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("restores a blank column title without saving", async () => {
    const { fetchMock } = mockApi();
    await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.tab();

    expect(input).toHaveValue("Backlog");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/columns/col-backlog", expect.anything());
  });

  it("adds and removes a card through the API", async () => {
    const { state } = mockApi();
    await renderBoard();
    const column = getFirstColumn();

    await addCard(column, "New card", "Notes");

    expect(await within(column).findByText("New card")).toBeInTheDocument();
    expect(state.board.cards["card-100"]).toEqual({
      id: "card-100",
      title: "New card",
      details: "Notes",
    });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    await waitFor(() => expect(state.board.cards["card-100"]).toBeUndefined());
  });

  it("adds the default details when the details are blank", async () => {
    mockApi();
    await renderBoard();
    const column = getFirstColumn();

    await addCard(column, "Details fallback");

    expect(await within(column).findByText("No details yet.")).toBeInTheDocument();
  });

  it("cancels adding a card", async () => {
    mockApi();
    await renderBoard();
    const column = getFirstColumn();
    const user = userEvent.setup();
    await user.click(within(column).getByRole("button", { name: /add a card/i }));
    await user.click(within(column).getByRole("button", { name: /cancel/i }));

    expect(within(column).getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });

  it("rolls back and shows an error when a save fails", async () => {
    const { state } = mockApi();
    await renderBoard();
    state.failMutations = true;
    const column = getFirstColumn();

    await userEvent.click(within(column).getByRole("button", { name: /delete align roadmap themes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your change.");
    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
  });
});

