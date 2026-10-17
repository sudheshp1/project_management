"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { LogoutIcon } from "@/components/icons";
import { findCardPosition, moveCard, type BoardData } from "@/lib/kanban";
import {
  ApiError,
  createCard,
  deleteCard,
  fetchBoard,
  moveCardTo,
  renameColumn,
} from "@/lib/api";

type KanbanBoardProps = {
  onLogout: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    fetchBoard().then(setBoard, (error) => {
      if (error instanceof ApiError && error.status === 401) {
        onLogout();
      } else {
        setLoadError(true);
      }
    });
  }, [onLogout, reloadKey]);

  const handleRetry = () => {
    setLoadError(false);
    setReloadKey((key) => key + 1);
  };

  if (!board) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        {loadError ? (
          <>
            <p role="alert" className="text-sm font-semibold text-[var(--navy-dark)]">
              Could not load your board.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Retry
            </button>
          </>
        ) : (
          <p role="status" className="text-sm font-semibold text-[var(--gray-text)]">
            Loading board...
          </p>
        )}
      </main>
    );
  }

  const save = async (request: () => Promise<BoardData>, optimistic?: BoardData) => {
    const previous = board;
    if (optimistic) {
      setBoard(optimistic);
    }
    try {
      setBoard(await request());
      setSaveError(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onLogout();
        return;
      }
      setBoard(previous);
      setSaveError(true);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const cardId = active.id as string;
    const columns = moveCard(board.columns, cardId, over.id as string);
    const target = findCardPosition(columns, cardId);
    if (columns === board.columns || !target) {
      return;
    }

    save(() => moveCardTo(cardId, target.columnId, target.position), {
      ...board,
      columns,
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    save(() => renameColumn(columnId, title), {
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    save(() => createCard(columnId, title, details || "No details yet."));
  };

  const handleDeleteCard = (cardId: string) => {
    save(() => deleteCard(cardId), {
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.cardIds.includes(cardId)
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    });
  };

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[2200px] flex-col gap-4 p-4 xl:h-screen xl:overflow-hidden">
      <header className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-white px-5 py-3 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
              Kanban Studio
            </h1>
            <p className="text-xs text-[var(--gray-text)]">
              Rename columns, drag cards between stages, or ask the assistant.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          <LogoutIcon />
          <span className="sr-only sm:not-sr-only">Log out</span>
        </button>
      </header>

      {saveError && (
        <p
          role="alert"
          className="rounded-2xl border border-[var(--accent-yellow)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy-dark)]"
        >
          Could not save your change. Please try again.
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid min-w-0 flex-1 auto-cols-[minmax(170px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <ChatSidebar onBoardUpdate={setBoard} onSessionExpired={onLogout} />
      </div>
    </main>
  );
};
