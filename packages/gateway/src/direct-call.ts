import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Direct-call mode: Gateway receives a request, translates it via provider adapters,
 * actually calls the LLM, and returns the LLM response (not the translated request).
 *
 * This contrasts with proxy mode, which only translates and returns the request object.
 */

export interface DirectCallResult {
  status: number;
  body: unknown;
}

/**
 * Handle a direct call request. For now returns a placeholder response.
 * Will be extended in Step 1.3 to actually call the LLM.
 */
export async function handleDirectCall(
  _request: IncomingMessage,
  response: ServerResponse,
  _protocol: "openai-chat" | "claude-messages" | "codex-responses",
): Promise<void> {
  // Placeholder: will be replaced with actual LLM call in Step 1.3
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok", mode: "direct" }));
}
