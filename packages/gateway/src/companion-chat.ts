import type { IncomingMessage, ServerResponse } from "node:http";
import { runConversation, type AgentLoopOptions } from "./agent-loop";

export interface CompanionChatOptions extends Omit<AgentLoopOptions, "companionContext"> {
  createCompanionContext?: (body: Record<string, unknown>) => AgentLoopOptions["companionContext"];
}

export async function handleCompanionChat(
  request: IncomingMessage,
  response: ServerResponse,
  options: CompanionChatOptions,
): Promise<void> {
  try {
    const body = await readJsonBody(request) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      sendJson(response, 400, { error: "message is required" });
      return;
    }
    const history = normalizeHistory(body.history);
    const result = await runConversation(message, history, {
      ...options,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : options.sessionId,
      companionContext: options.createCompanionContext?.(body),
    });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, {
      error: "companion-chat-failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function normalizeHistory(raw: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      role: typeof item.role === "string" ? item.role : "user",
      content: typeof item.content === "string" ? item.content : "",
    }))
    .filter((item) => item.content.length > 0);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
  });
}
