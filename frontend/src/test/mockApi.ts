import { vi } from "vitest";
import { initialData, type BoardData } from "@/lib/kanban";

type MockApiOptions = {
  signedIn?: boolean;
  failBoard?: boolean;
  failMutations?: boolean;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

// In-memory stand-in for the FastAPI backend, installed as the global fetch.
export const mockApi = ({
  signedIn = true,
  failBoard = false,
  failMutations = false,
}: MockApiOptions = {}) => {
  let session = signedIn;
  let nextId = 100;
  const state = {
    failBoard,
    failMutations,
    board: structuredClone(initialData) as BoardData,
  };

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : {};

    if (url === "/api/login") {
      session = body.username === "user" && body.password === "password";
      return json({ username: body.username }, session ? 200 : 401);
    }
    if (url === "/api/logout") {
      session = false;
      return new Response(null, { status: 204 });
    }
    if (!session) {
      return json({ detail: "Not authenticated" }, 401);
    }
    if (url === "/api/me") {
      return json({ username: "user" });
    }
    if (url === "/api/board") {
      return state.failBoard ? json({ detail: "Error" }, 500) : json(state.board);
    }
    if (state.failMutations) {
      return json({ detail: "Error" }, 500);
    }

    const { board } = state;
    const columnMatch = url.match(/^\/api\/columns\/(.+)$/);
    const cardMatch = url.match(/^\/api\/cards\/([^/]+)(\/move)?$/);
    const withoutCard = (cardId: string) =>
      board.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => id !== cardId),
      }));

    if (columnMatch) {
      board.columns = board.columns.map((column) =>
        column.id === columnMatch[1] ? { ...column, title: body.title } : column
      );
    } else if (url === "/api/cards") {
      const id = `card-${nextId++}`;
      board.cards[id] = { id, title: body.title, details: body.details };
      board.columns = board.columns.map((column) =>
        column.id === body.columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      );
    } else if (cardMatch && method === "DELETE") {
      delete board.cards[cardMatch[1]];
      board.columns = withoutCard(cardMatch[1]);
    } else if (cardMatch?.[2]) {
      board.columns = withoutCard(cardMatch[1]).map((column) => {
        if (column.id !== body.columnId) {
          return column;
        }
        const cardIds = [...column.cardIds];
        cardIds.splice(body.position, 0, cardMatch[1]);
        return { ...column, cardIds };
      });
    } else {
      return json({ detail: "Not found" }, 404);
    }
    return json(board);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, state };
};
