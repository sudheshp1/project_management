import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const user = userEvent.setup();
    await user.click(within(column).getByRole("button", { name: /add a card/i }));

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await user.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await user.type(detailsInput, "Notes");

    await user.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await user.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("adds the default details when the details are blank", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const user = userEvent.setup();
    await user.click(within(column).getByRole("button", { name: /add a card/i }));
    await user.type(within(column).getByPlaceholderText(/card title/i), "Details fallback");
    await user.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("No details yet.")).toBeInTheDocument();
  });

  it("cancels adding a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const user = userEvent.setup();
    await user.click(within(column).getByRole("button", { name: /add a card/i }));
    await user.click(within(column).getByRole("button", { name: /cancel/i }));

    expect(within(column).getByRole("button", { name: /add a card/i })).toBeInTheDocument();
  });
});
