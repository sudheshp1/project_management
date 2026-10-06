import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createCard,
  deleteCard,
  fetchBoard,
  moveCardTo,
  renameColumn,
} from "@/lib/api";
import { initialData } from "@/lib/kanban";

const stubFetch = (status = 200) => {
  const fetchMock = vi.fn(async () => Response.json(initialData, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("fetches the board", async () => {
    const fetchMock = stubFetch();

    await expect(fetchBoard()).resolves.toEqual(initialData);
    expect(fetchMock).toHaveBeenCalledWith("/api/board", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
  });

  it.each([
    [() => renameColumn("col-a", "New"), "/api/columns/col-a", "PATCH", { title: "New" }],
    [
      () => createCard("col-a", "Title", "Notes"),
      "/api/cards",
      "POST",
      { columnId: "col-a", title: "Title", details: "Notes" },
    ],
    [
      () => moveCardTo("card-1", "col-b", 2),
      "/api/cards/card-1/move",
      "POST",
      { columnId: "col-b", position: 2 },
    ],
  ])("sends JSON mutations to %s", async (call, url, method, body) => {
    const fetchMock = stubFetch();

    await call();

    expect(fetchMock).toHaveBeenCalledWith(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  it("deletes a card without a body", async () => {
    const fetchMock = stubFetch();

    await deleteCard("card-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/cards/card-1", {
      method: "DELETE",
      headers: undefined,
      body: undefined,
    });
  });

  it("throws an ApiError with the status on failure", async () => {
    stubFetch(401);

    await expect(fetchBoard()).rejects.toEqual(new ApiError(401));
    await expect(fetchBoard()).rejects.toHaveProperty("status", 401);
  });
});
