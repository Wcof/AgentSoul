import type { IncomingMessage, ServerResponse } from "node:http";
import type { StoredProviderProfile } from "@agentsoul/provider";
import { translateGatewayRoute, type GatewayClientRequest } from "./providers";

/**
 * Direct-call mode: Gateway receives a request, translates it via provider adapters,
 * actually calls the LLM, and returns the LLM response (not the translated request).
 *
 * This contrasts with proxy mode, which only translates and returns the request object.
 */

export interface DirectCallOptions {
  providerProfiles: { getActiveProviderProfile(): StoredProviderProfile | null };
}

export async function handleDirectCall(
  request: IncomingMessage,
  response: ServerResponse,
  protocol: "openai-chat" | "claude-messages" | "codex-responses",
  options: DirectCallOptions,
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const active = options.providerProfiles.getActiveProviderProfile();

  if (!active) {
    sendJson(response, 409, { error: "no-active-provider-profile" });
    return;
  }

  const clientRequest: GatewayClientRequest = {
    clientProtocol: protocol,
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages: Array.isArray(body.messages)
      ? (body.messages as Array<{ role: string; content: string }>)
      : [],
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
  };

  const route = translateGatewayRoute(active, clientRequest);
  if (route.status !== "translated") {
    sendJson(response, 422, { error: "unsupported-route", reason: route.reason });
    return;
  }

  const { providerRequest } = route;

  try {
    const llmResponse = await fetch(providerRequest.url, {
      method: providerRequest.method,
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
    });

    const llmBody = await llmResponse.json();
    sendJson(response, llmResponse.status, llmBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(response, 502, { error: "provider-call-failed", message });
  }
}

// ─── Internal helpers ───

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
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
  });
}
