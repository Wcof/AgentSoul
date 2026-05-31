import type { StoredProviderProfile } from "@agentsoul/provider";
import type { GatewayClientRequest, GatewayRouteResult, ProviderAdapter } from "./index";

export const AnthropicMessagesCompatibleAdapter: ProviderAdapter = {
  name: "anthropic-messages",
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean {
    return request.clientProtocol === "claude-messages" && profile.providerProtocol === "anthropic";
  },
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult {
    return {
      status: "translated",
      adapter: this.name,
      liveProviderCallRequired: false,
      providerRequest: {
        method: "POST",
        url: `${profile.endpoint.replace(/\/$/, "")}/v1/messages`,
        headers: {
          "content-type": "application/json",
          "x-api-key": `Credential ${String(profile.credentialRef ?? "")}`,
          "anthropic-version": "2023-06-01",
        },
        body: {
          model: profile.targetModel,
          messages: request.messages ?? [],
        },
      },
    };
  },
};
