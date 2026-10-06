import { findCardPosition, moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("keeps columns unchanged for unknown cards", () => {
    expect(moveCard(baseColumns, "missing-card", "card-1")).toBe(baseColumns);
  });

  it("does not change the order when dropped on the same card", () => {
    expect(moveCard(baseColumns, "card-1", "card-1")).toBe(baseColumns);
  });
});

describe("findCardPosition", () => {
  const columns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("returns the column and index of a card", () => {
    expect(findCardPosition(columns, "card-2")).toEqual({ columnId: "col-a", position: 1 });
    expect(findCardPosition(columns, "card-3")).toEqual({ columnId: "col-b", position: 0 });
  });

  it("returns undefined for unknown cards", () => {
    expect(findCardPosition(columns, "missing")).toBeUndefined();
  });
});
