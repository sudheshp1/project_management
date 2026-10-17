import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { TrashIcon } from "@/components/icons";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group cursor-grab rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(3,33,71,0.06)]",
        "transition-all duration-150 hover:border-[var(--primary-blue)]",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="break-words font-display text-sm font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-1 break-words text-xs leading-5 text-[var(--gray-text)]">
            {card.details}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)] focus-visible:opacity-100 xl:opacity-0 xl:group-hover:opacity-100"
          aria-label={`Delete ${card.title}`}
          title="Delete card"
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
};
