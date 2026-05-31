import type { StoredProviderProfile } from "@agentsoul/provider";

// ─── Gateway routing types ───

export interface GatewayClientRequest {
  clientProtocol: string;
  requestedModel?: string;
  messages?: Array<{ role: string; content: string }>;
  adapterMetadata?: Record<string, unknown>;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface GatewayRouteResult {
  status: "translated";
  adapter: string;
  liveProviderCallRequired: false;
  providerRequest: {
    method: "POST";
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
}

export interface UnsupportedRouteResult {
  status: "unsupported-route";
  reason: string;
  liveProviderCallRequired: false;
}

export interface ProviderAdapter {
  name: string;
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean;
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult;
}

// ─── Adapter registry ───

import { OpenAICompatibleAdapter } from "./openai";
import { CodexResponsesCompatibleAdapter } from "./codex";
import { OpenAIImagesCompatibleAdapter } from "./images";
import { AnthropicMessagesCompatibleAdapter } from "./anthropic";

export { OpenAICompatibleAdapter } from "./openai";
export { CodexResponsesCompatibleAdapter } from "./codex";
export { OpenAIImagesCompatibleAdapter } from "./images";
export { AnthropicMessagesCompatibleAdapter } from "./anthropic";

const providerAdapters: ProviderAdapter[] = [
  OpenAICompatibleAdapter,
  CodexResponsesCompatibleAdapter,
  OpenAIImagesCompatibleAdapter,
  AnthropicMessagesCompatibleAdapter,
];

export function translateGatewayRoute(
  active: StoredProviderProfile,
  request: GatewayClientRequest,
): GatewayRouteResult | UnsupportedRouteResult {
  const adapter = providerAdapters.find((candidate) => candidate.supports(active, request));

  if (!adapter) {
    return {
      status: "unsupported-route",
      reason: `${request.clientProtocol} -> ${active.providerProtocol} is not supported by an available Provider Adapter.`,
      liveProviderCallRequired: false,
    };
  }

  return adapter.translate(active, request);
}
