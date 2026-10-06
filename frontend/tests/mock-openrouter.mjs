// Fake OpenRouter chat completions endpoint for Playwright. The reply depends on the user's message.
import { createServer } from "node:http";

const op = (fields) => ({
  type: null, cardId: null, columnId: null, title: null, details: null, position: null, ...fields,
});

const respond = (message) => {
  if (message.includes("add")) {
    return {
      reply: "Added an AI card to Review.",
      operations: [op({ type: "create", columnId: "col-review", title: "AI card", details: "From the assistant" })],
    };
  }
  if (message.includes("move")) {
    return {
      reply: "Moved the roadmap card to Done.",
      operations: [op({ type: "move", cardId: "card-1", columnId: "col-done", position: 0 })],
    };
  }
  return { reply: "Hello from the mock assistant.", operations: [] };
};

createServer((request, response) => {
  if (request.method !== "POST") {
    response.end("ok");
    return;
  }
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const message = JSON.parse(body).messages.at(-1).content.toLowerCase();
    if (message.includes("fail")) {
      response.writeHead(500).end("upstream error");
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(respond(message)) } }] }));
  });
}).listen(8002, "127.0.0.1");
