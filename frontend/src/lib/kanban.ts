export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

// The column with this id, or the column holding the card with this id.
const findColumn = (columns: Column[], id: string) =>
  columns.find((column) => column.id === id) ??
  columns.find((column) => column.cardIds.includes(id));

// Moves a card onto another card (taking its place) or onto a column (to its end).
export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumn = findColumn(columns, activeId);
  const overColumn = findColumn(columns, overId);
  if (!activeColumn || !overColumn) {
    return columns;
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  const overIndex =
    overColumn.id === overId
      ? overColumn.cardIds.length
      : overColumn.cardIds.indexOf(overId);
  if (activeIndex === -1 || (activeColumn === overColumn && activeIndex === overIndex)) {
    return columns;
  }

  return columns.map((column) => {
    let cardIds = column.cardIds;
    if (column === activeColumn) {
      cardIds = cardIds.toSpliced(activeIndex, 1);
    }
    if (column === overColumn) {
      cardIds = cardIds.toSpliced(overIndex, 0, activeId);
    }
    return cardIds === column.cardIds ? column : { ...column, cardIds };
  });
};

export const findCardPosition = (columns: Column[], cardId: string) => {
  const column = columns.find((item) => item.cardIds.includes(cardId));
  return column
    ? { columnId: column.id, position: column.cardIds.indexOf(cardId) }
    : undefined;
};
