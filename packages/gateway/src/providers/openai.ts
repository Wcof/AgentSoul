import type { StoredProviderProfile } from "@agentsoul/provider";
import type { GatewayClientRequest, GatewayRouteResult, ProviderAdapter } from "./index";

export const OpenAICompatibleAdapter: ProviderAdapter = {
  name: "openai-chat",
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean {
    return request.clientProtocol === "openai-chat" && profile.providerProtocol === "openai-chat";
  },
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult {
    return {
      status: "translated",
      adapter: this.name,
      liveProviderCallRequired: false,
      providerRequest: {
        method: "POST",
        url: `${profile.endpoint.replace(/\/$/, "")}/chat/completions`,
        headers: {
          "content-type": "application/json",
          authorization: `Credential ${String(profile.credentialRef ?? "")}`,
        },
        body: {
          model: profile.targetModel,
          messages: request.messages ?? [],
        },
      },
    };
  },
};
