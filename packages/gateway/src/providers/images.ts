import type { StoredProviderProfile } from "@agentsoul/provider";
import type { GatewayClientRequest, GatewayRouteResult, ProviderAdapter } from "./index";

export const OpenAIImagesCompatibleAdapter: ProviderAdapter = {
  name: "openai-images",
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean {
    return request.clientProtocol === "openai-images" && profile.providerProtocol === "openai-chat";
  },
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult {
    const operation = (request.adapterMetadata?.operation as string | undefined) ?? "generations";
    return {
      status: "translated",
      adapter: this.name,
      liveProviderCallRequired: false,
      providerRequest: {
        method: "POST",
        url: `${profile.endpoint.replace(/\/$/, "")}/images/${operation}`,
        headers: {
          "content-type": "application/json",
          authorization: `Credential ${String(profile.credentialRef ?? "")}`,
        },
        body: {
          ...(request.adapterMetadata?.rawBody as Record<string, unknown> | undefined),
          model: request.requestedModel ?? profile.targetModel,
        },
      },
    };
  },
};
