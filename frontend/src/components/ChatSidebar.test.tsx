import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { mockApi } from "@/test/mockApi";

const send = async (text: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Message"), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
};

const lastChatBody = (fetchMock: ReturnType<typeof mockApi>["fetchMock"]) => {
  const call = fetchMock.mock.calls.filter(([url]) => url === "/api/chat").at(-1);
  return JSON.parse(call?.[1]?.body as string);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatSidebar", () => {
  it("shows an empty conversation", () => {
    mockApi();
    render(<ChatSidebar onBoardUpdate={() => {}} onSessionExpired={() => {}} />);

    expect(screen.getByRole("complementary", { name: "AI assistant" })).toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends messages with history and shows replies", async () => {
    const { fetchMock, state } = mockApi();
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} onSessionExpired={() => {}} />);
    const log = screen.getByRole("log");

    state.chatReply = "First reply";
    await send("Hello");
    expect(await within(log).findByText("First reply")).toBeInTheDocument();
    expect(within(log).getByText("Hello")).toBeInTheDocument();
    expect(lastChatBody(fetchMock)).toEqual({ history: [], message: "Hello" });
    expect(onBoardUpdate).toHaveBeenCalledWith(state.board);

    state.chatReply = "Second reply";
    await send("What next?");
    expect(await within(log).findByText("Second reply")).toBeInTheDocument();
    expect(lastChatBody(fetchMock)).toEqual({
      history: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "First reply" },
      ],
      message: "What next?",
    });
  });

  it("shows a sending state while waiting", async () => {
    const { fetchMock } = mockApi();
    let respond: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (respond = resolve)));
    render(<ChatSidebar onBoardUpdate={() => {}} onSessionExpired={() => {}} />);

    await send("Hello");

    expect(screen.getByRole("status")).toHaveTextContent("Assistant is thinking...");
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    respond(Response.json({ reply: "Done", board: { columns: [], cards: {} } }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sends on Enter and keeps Shift+Enter for new lines", async () => {
    const { fetchMock } = mockApi();
    render(<ChatSidebar onBoardUpdate={() => {}} onSessionExpired={() => {}} />);
    const input = screen.getByLabelText("Message");

    await userEvent.type(input, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(input).toHaveValue("Line one\nLine two");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(input, "{Enter}");
    await waitFor(() => expect(lastChatBody(fetchMock).message).toBe("Line one\nLine two"));
  });

  it("shows an error and restores the message when the request fails", async () => {
    const { state } = mockApi();
    state.chatStatus = 502;
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} onSessionExpired={() => {}} />);

    await send("Move everything");

    expect(await screen.findByRole("alert")).toHaveTextContent("The assistant could not respond.");
    expect(screen.getByLabelText("Message")).toHaveValue("Move everything");
    expect(within(screen.getByRole("log")).queryByText("Move everything")).not.toBeInTheDocument();
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("returns to sign-in when the session has expired", async () => {
    const { state } = mockApi();
    state.chatStatus = 401;
    const onSessionExpired = vi.fn();
    render(<ChatSidebar onBoardUpdate={() => {}} onSessionExpired={onSessionExpired} />);

    await send("Hello");

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it("refreshes the visible board after AI changes", async () => {
    const { state } = mockApi();
    render(<KanbanBoard onLogout={() => {}} />);
    await screen.findByRole("heading", { name: "Kanban Studio" });
    state.chatReply = "Moved it to Done.";
    state.chatChange = (board) => {
      board.columns[0].cardIds = board.columns[0].cardIds.filter((id) => id !== "card-1");
      board.columns[4].cardIds.unshift("card-1");
    };

    await send("Move the roadmap card to Done");

    expect(await screen.findByText("Moved it to Done.")).toBeInTheDocument();
    const done = screen.getByTestId("column-col-done");
    expect(within(done).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(screen.getByTestId("column-col-backlog")).queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });
});
