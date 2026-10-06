import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Request failed with status ${status}`);
  }
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  board: BoardData;
};

const request = async <T = BoardData>(
  url: string,
  method = "GET",
  body?: unknown
): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response.json();
};

export const fetchBoard = () => request("/api/board");

export const renameColumn = (columnId: string, title: string) =>
  request(`/api/columns/${columnId}`, "PATCH", { title });

export const createCard = (columnId: string, title: string, details: string) =>
  request("/api/cards", "POST", { columnId, title, details });

export const deleteCard = (cardId: string) =>
  request(`/api/cards/${cardId}`, "DELETE");

export const moveCardTo = (cardId: string, columnId: string, position: number) =>
  request(`/api/cards/${cardId}/move`, "POST", { columnId, position });

export const sendChat = (history: ChatMessage[], message: string) =>
  request<ChatResponse>("/api/chat", "POST", { history, message });
