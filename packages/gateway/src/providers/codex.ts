import type { StoredProviderProfile } from "@agentsoul/provider";
import type { GatewayClientRequest, GatewayRouteResult, ProviderAdapter } from "./index";

export const CodexResponsesCompatibleAdapter: ProviderAdapter = {
  name: "codex-responses",
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean {
    return request.clientProtocol === "codex-responses" && profile.providerProtocol === "openai-chat";
  },
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult {
    return {
      status: "translated",
      adapter: this.name,
      liveProviderCallRequired: false,
      providerRequest: {
        method: "POST",
        url: `${profile.endpoint.replace(/\/$/, "")}/responses`,
        headers: {
          "content-type": "application/json",
          authorization: `Credential ${String(profile.credentialRef ?? "")}`,
        },
        body: {
          model: profile.targetModel,
          input: request.messages ?? [],
        },
      },
    };
  },
};
