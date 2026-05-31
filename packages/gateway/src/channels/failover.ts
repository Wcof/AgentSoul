import type { StoredProviderProfile } from "@agentsoul/provider";
import type { ControlPlaneStore } from "@agentsoul/persistence";
import type { Channel, ChannelStore, ChannelType } from "./store";
import type { GatewayClientRequest, GatewayRouteResult } from "../providers";
import { translateGatewayRoute } from "../providers";

// ─── Failover policy ───

export interface FailoverPolicy {
  autoFailover: boolean;
  failoverThreshold: number;
  circuitBreakerTimeoutSeconds: number;
}

export function loadFailoverPolicy(controlPlaneStore: ControlPlaneStore | undefined): FailoverPolicy {
  const settings = controlPlaneStore?.settings.load();
  return {
    autoFailover: settings?.autoFailover ?? true,
    failoverThreshold: Math.max(1, Number(settings?.failoverThreshold ?? 5)),
    circuitBreakerTimeoutSeconds: Math.max(1, Number(settings?.circuitBreakerTimeout ?? 60)),
  };
}

// ─── Channel routing ───

export function routeThroughChannels(
  channelStore: ChannelStore | undefined,
  clientRequest: GatewayClientRequest,
  failoverPolicy: FailoverPolicy,
): { profile: StoredProviderProfile; route: GatewayRouteResult; channelId: string } | undefined {
  if (!channelStore) {
    return undefined;
  }
  const baseCandidates = channelStore
    .listChannels()
    .filter((channel) => channel.status === "active" || channel.status === "healthy")
    .sort((left, right) => right.priority - left.priority);
  const candidates = failoverPolicy.autoFailover
    ? baseCandidates.filter((channel) => {
        const metrics = channelStore.getChannelMetrics(channel.id);
        if (!metrics || metrics.circuitState !== "open") {
          return true;
        }
        const timeoutMs = failoverPolicy.circuitBreakerTimeoutSeconds * 1000;
        const lastFailureAt = metrics.lastFailureAt ? Date.parse(metrics.lastFailureAt) : Number.NaN;
        if (Number.isNaN(lastFailureAt)) {
          return false;
        }
        return Date.now() - lastFailureAt >= timeoutMs;
      })
    : baseCandidates.slice(0, 1);

  for (const channel of candidates) {
    const profile = providerProfileFromChannel(channel, clientRequest);
    if (!profile) {
      continue;
    }
    const route = translateGatewayRoute(profile, clientRequest);
    if (route.status === "translated") {
      return { profile, route, channelId: channel.id };
    }
  }
  return undefined;
}

// ─── Internal helpers ───

function providerProfileFromChannel(
  channel: Channel,
  clientRequest: GatewayClientRequest,
): StoredProviderProfile | undefined {
  const protocol = providerProtocolForChannel(channel.type);
  const compatibleClient = isClientProtocolCompatible(channel.type, clientRequest.clientProtocol);
  if (!protocol || !compatibleClient) {
    return undefined;
  }
  const mappedModel = resolveMappedModel(channel, clientRequest.requestedModel);
  const endpoint = channel.baseUrl;
  const credentialRef = channel.apiKeys[0] ?? `channel:${channel.id}:no-key`;
  return {
    id: `channel:${channel.id}`,
    name: channel.name,
    activationMode: "gateway-route",
    credentialRef,
    clientProtocol: compatibleClient,
    providerProtocol: protocol,
    targetModel: mappedModel,
    endpoint,
    adapterSettings: {},
    updatedAt: channel.updatedAt,
  };
}

function providerProtocolForChannel(type: ChannelType): "openai-chat" | "anthropic" | undefined {
  if (type === "openai" || type === "codex" || type === "gemini") {
    return "openai-chat";
  }
  if (type === "claude") {
    return "anthropic";
  }
  return undefined;
}

function isClientProtocolCompatible(
  type: ChannelType,
  requested: string,
): "openai-chat" | "codex-responses" | "openai-images" | "claude-messages" | undefined {
  if (
    (type === "openai" || type === "codex" || type === "gemini")
    && (requested === "openai-chat" || requested === "codex-responses" || requested === "openai-images")
  ) {
    return requested as "openai-chat" | "codex-responses" | "openai-images";
  }
  if (type === "claude" && requested === "claude-messages") {
    return "claude-messages";
  }
  return undefined;
}

function resolveMappedModel(channel: Channel, requestedModel: string | undefined): string {
  const mapping = channel.modelMapping ?? {};
  const supported = channel.supportedModels ?? [];
  if (requestedModel && typeof mapping[requestedModel] === "string" && mapping[requestedModel].trim().length > 0) {
    return mapping[requestedModel];
  }
  if (requestedModel && supported.includes(requestedModel)) {
    return requestedModel;
  }
  if (supported.length > 0) {
    return supported[0];
  }
  return requestedModel || "default-model";
}
