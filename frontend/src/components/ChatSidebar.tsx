import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import clsx from "clsx";
import { ApiError, sendChat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { SendIcon } from "@/components/icons";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
  onSessionExpired: () => void;
};

export const ChatSidebar = ({ onBoardUpdate, onSessionExpired }: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending) {
      return;
    }

    const history = messages;
    const sent: ChatMessage[] = [...history, { role: "user", content: message }];
    setMessages(sent);
    setInput("");
    setSending(true);
    setError(false);
    try {
      const { reply, board } = await sendChat(history, message);
      setMessages([...sent, { role: "assistant", content: reply }]);
      onBoardUpdate(board);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setMessages(history);
      setInput(message);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <aside
      aria-label="AI assistant"
      className="flex h-[560px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow)] xl:h-auto xl:w-[300px] xl:shrink-0 2xl:w-[360px]"
    >
      <div className="border-b-2 border-[var(--accent-yellow)] pb-2">
        <h2 className="px-1 font-display text-base font-semibold text-[var(--navy-dark)]">AI assistant</h2>
        <p className="px-1 text-xs leading-5 text-[var(--gray-text)]">
          Ask about your board, or ask me to create, edit, or move cards.
        </p>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="m-auto max-w-[220px] text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            No messages yet
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--navy-dark)] text-white"
                : "self-start bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
            {message.content}
          </div>
        ))}
        {sending && (
          <p role="status" className="self-start text-xs font-semibold text-[var(--primary-blue)]">
            Assistant is thinking...
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-[var(--accent-yellow)] px-3 py-2 text-xs font-semibold text-[var(--navy-dark)]"
        >
          The assistant could not respond. Please try again.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the assistant..."
          aria-label="Message"
          rows={3}
          maxLength={10000}
          className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={sending ? "Sending..." : "Send"}
          title="Send"
          className="rounded-xl bg-[var(--secondary-purple)] p-3 text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </form>
    </aside>
  );
};
