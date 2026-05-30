import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import { initializeV2Database, createControlPlaneStore, type ControlPlaneStore, SessionRepository } from "@agentsoul/persistence";
import type { ProviderProfileService, StoredProviderProfile } from "@agentsoul/provider";
import { pingUrlHead } from "./http-ping";

export interface LocalGatewayOptions {
  providerProfiles: Pick<ProviderProfileService, "getActiveProviderProfile">;
  audit?: GatewayAuditRepository;
  channelStore?: ChannelStore;
  costTracker?: CostTracker;
  controlPlaneStore?: ControlPlaneStore;
  sessionRepository?: SessionRepository;
  proxyAccessKey?: string;
  adminAccessKey?: string;
  host?: string;
  port?: number;
}

export interface GatewayHealth {
  status: "ok";
  routeReady: boolean;
  activeProviderProfile: GatewayProviderProfileSummary | null;
  liveProviderCallRequired: false;
}

export interface GatewayProviderProfileSummary {
  id: string;
  name: string;
  activationMode: string;
  credentialRef?: string;
  clientProtocol: string;
  providerProtocol: string;
  targetModel: string;
  endpoint: string;
}

export interface LocalGateway {
  port: number;
  url(path?: string): string;
  health(): GatewayHealth;
  close(): Promise<void>;
}

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

export interface TrafficMetadata {
  gatewayEventId: string;
  clientProtocol: string;
  providerProtocol?: string;
  providerProfileId?: string;
  model?: string;
  route: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  outcome: string;
}

export interface GatewayAuditRecord {
  id: string;
  gatewayEventId: string;
  trafficMetadata: TrafficMetadata;
  estimatedCost: number;
  outcome: string;
  evidenceHash?: string;
  occurredAt: string;
}

export interface GatewayAuditRepository {
  recordAudit(input: {
    trafficMetadata: TrafficMetadata;
    estimatedCost: number;
    outcome: string;
    evidenceHash?: string;
    occurredAt?: string;
  }): GatewayAuditRecord;
  listAuditRecords(): GatewayAuditRecord[];
  summarizeCostTrends(input: {
    from: string;
    to: string;
  }): GatewayCostTrends;
  close(): void;
}

export interface GatewayCostTrends {
  dailyCosts: DailyCostTrend[];
  modelMix: CostMixEntry[];
  providerMix: ProviderCostMixEntry[];
}

export interface DailyCostTrend {
  date: string;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  averageLatencyMs: number;
}

export interface CostMixEntry {
  model: string;
  requestCount: number;
  estimatedCost: number;
}

export interface ProviderCostMixEntry {
  providerProfileId: string;
  requestCount: number;
  estimatedCost: number;
}

export interface ProviderAdapter {
  name: string;
  supports(profile: StoredProviderProfile, request: GatewayClientRequest): boolean;
  translate(profile: StoredProviderProfile, request: GatewayClientRequest): GatewayRouteResult;
}

export const OpenAICompatibleAdapter: ProviderAdapter = {
  name: "openai-chat",
  supports(profile, request) {
    return request.clientProtocol === "openai-chat" && profile.providerProtocol === "openai-chat";
  },
  translate(profile, request) {
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

export const CodexResponsesCompatibleAdapter: ProviderAdapter = {
  name: "codex-responses",
  supports(profile, request) {
    return request.clientProtocol === "codex-responses" && profile.providerProtocol === "openai-chat";
  },
  translate(profile, request) {
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

export const OpenAIImagesCompatibleAdapter: ProviderAdapter = {
  name: "openai-images",
  supports(profile, request) {
    return request.clientProtocol === "openai-images" && profile.providerProtocol === "openai-chat";
  },
  translate(profile, request) {
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

export const AnthropicMessagesCompatibleAdapter: ProviderAdapter = {
  name: "anthropic-messages",
  supports(profile, request) {
    return request.clientProtocol === "claude-messages" && profile.providerProtocol === "anthropic";
  },
  translate(profile, request) {
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

const providerAdapters: ProviderAdapter[] = [
  OpenAICompatibleAdapter,
  CodexResponsesCompatibleAdapter,
  OpenAIImagesCompatibleAdapter,
  AnthropicMessagesCompatibleAdapter,
];

export async function startLocalGateway(options: LocalGatewayOptions): Promise<LocalGateway> {
  const host = options.host ?? "127.0.0.1";
  const server = createServer((request, response) => {
    routeHttp(options, request, response);
  });

  await listen(server, options.port ?? 0, host);
  const address = server.address() as AddressInfo;

  return {
    port: address.port,
    url(path = "/") {
      return `http://${host}:${address.port}${path}`;
    },
    health() {
      return createGatewayHealth(options.providerProfiles.getActiveProviderProfile());
    },
    close() {
      return close(server);
    },
  };
}

function routeHttp(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "costTracker" | "controlPlaneStore" | "sessionRepository" | "proxyAccessKey" | "adminAccessKey">,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const url = request.url ?? "";
  if (requiresProxyAuth(url) && !isAuthorizedProxyRequest(request, options.proxyAccessKey)) {
    sendJson(response, 401, { error: "unauthorized", reason: "Missing or invalid proxy access key" });
    return;
  }
  if (requiresAdminAuth(url) && !isAuthorizedAdminRequest(request, options.adminAccessKey, options.proxyAccessKey)) {
    sendJson(response, 401, { error: "unauthorized", reason: "Missing or invalid admin access key" });
    return;
  }

  if (request.method === "GET" && url === "/health") {
    sendJson(response, 200, createGatewayHealth(options.providerProfiles.getActiveProviderProfile()));
    return;
  }

  if (request.method === "GET" && url === "/v1/models") {
    handleListModels(options, response);
    return;
  }

  if (request.method === "POST" && url === "/route") {
    void handleRouteHttp(options, request, response);
    return;
  }

  if (request.method === "POST" && url === "/v1/chat/completions") {
    void handleRouteFromOpenAIChat(options, request, response);
    return;
  }
  if (request.method === "POST" && url === "/v1/responses") {
    void handleRouteFromCodexResponses(options, request, response);
    return;
  }
  if (request.method === "POST" && url === "/v1/messages") {
    void handleRouteFromClaudeMessages(options, request, response);
    return;
  }
  if (request.method === "POST" && url === "/v1/images/generations") {
    void handleRouteFromOpenAIImages(options, request, response, "generations");
    return;
  }
  if (request.method === "POST" && url === "/v1/images/edits") {
    void handleRouteFromOpenAIImages(options, request, response, "edits");
    return;
  }
  if (request.method === "POST" && url === "/v1/images/variations") {
    void handleRouteFromOpenAIImages(options, request, response, "variations");
    return;
  }

  // ─── 渠道管理 API ───
  if (request.method === "GET" && url === "/channels") {
    handleListChannels(options, response);
    return;
  }

  if (request.method === "POST" && url === "/channels") {
    void handleCreateChannel(options, request, response);
    return;
  }

  const channelMatch = url.match(/^\/channels\/([^/]+)$/);
  if (channelMatch) {
    const channelId = channelMatch[1];
    if (request.method === "GET") {
      handleGetChannel(options, channelId, response);
      return;
    }
    if (request.method === "PUT") {
      void handleUpdateChannel(options, channelId, request, response);
      return;
    }
    if (request.method === "DELETE") {
      handleDeleteChannel(options, channelId, response);
      return;
    }
  }

  const channelMetricsMatch = url.match(/^\/channels\/([^/]+)\/metrics$/);
  if (channelMetricsMatch && request.method === "GET") {
    handleGetChannelMetrics(options, channelMetricsMatch[1], response);
    return;
  }

  const channelPingMatch = url.match(/^\/channels\/([^/]+)\/ping$/);
  if (channelPingMatch && request.method === "POST") {
    void handlePingChannel(options, channelPingMatch[1], response);
    return;
  }

  if (request.method === "GET" && url === "/costs/summary") {
    handleGetCostSummary(options, response);
    return;
  }

  if (request.method === "GET" && url === "/dashboard") {
    handleGetDashboard(options, response);
    return;
  }

  // ─── 应用设置 API ───
  if (request.method === "GET" && url === "/settings") {
    handleGetAppSettings(options, response);
    return;
  }

  if (request.method === "PUT" && url === "/settings") {
    void handleUpdateAppSettings(options, request, response);
    return;
  }

  // ─── Skills 状态 API ───
  if (request.method === "GET" && url === "/skills") {
    handleGetSkillsState(options, response);
    return;
  }
  if (request.method === "PUT" && url === "/skills") {
    void handleUpdateSkillsState(options, request, response);
    return;
  }

  // ─── Prompt 模板 API ───
  if (request.method === "GET" && url === "/prompts") {
    handleListPrompts(options, response);
    return;
  }
  if (request.method === "POST" && url === "/prompts") {
    void handleCreatePrompt(options, request, response);
    return;
  }
  const promptFavoriteMatch = url.match(/^\/prompts\/([^/]+)\/favorite$/);
  if (promptFavoriteMatch && request.method === "PUT") {
    void handleTogglePromptFavorite(options, promptFavoriteMatch[1], request, response);
    return;
  }
  const promptMatch = url.match(/^\/prompts\/([^/]+)$/);
  if (promptMatch && request.method === "DELETE") {
    handleDeletePrompt(options, promptMatch[1], response);
    return;
  }

  // ─── MCP 服务器管理 API ───
  if (request.method === "GET" && url === "/mcp-servers") {
    handleListMcpServers(options, response);
    return;
  }

  if (request.method === "POST" && url === "/mcp-servers") {
    void handleCreateMcpServer(options, request, response);
    return;
  }

  const mcpToggleMatch = url.match(/^\/mcp-servers\/([^/]+)\/toggle$/);
  if (mcpToggleMatch && request.method === "PUT") {
    handleToggleMcpServer(options, mcpToggleMatch[1], response);
    return;
  }

  const mcpMatch = url.match(/^\/mcp-servers\/([^/]+)$/);
  if (mcpMatch && request.method === "DELETE") {
    handleDeleteMcpServer(options, mcpMatch[1], response);
    return;
  }

  // ─── 会话管理 API ───
  if (request.method === "GET" && url.startsWith("/sessions")) {
    handleListSessions(options, response);
    return;
  }

  const sessionResumeMatch = url.match(/^\/sessions\/([^/]+)\/resume$/);
  if (sessionResumeMatch && request.method === "POST") {
    handleResumeSession(options, sessionResumeMatch[1], response);
    return;
  }

  const sessionMatch = url.match(/^\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "DELETE") {
    handleDeleteSession(options, sessionMatch[1], response);
    return;
  }

  // ─── 安全审批 API ───
  if (request.method === "GET" && url === "/approval-requests") {
    handleListApprovalRequests(options, response);
    return;
  }
  if (request.method === "POST" && url === "/approval-requests") {
    void handleCreateApprovalRequest(options, request, response);
    return;
  }
  const approvalMatch = url.match(/^\/approval-requests\/([^/]+)$/);
  if (approvalMatch) {
    if (request.method === "PUT") {
      void handleUpdateApprovalStatus(options, approvalMatch[1], request, response);
      return;
    }
    if (request.method === "DELETE") {
      handleDeleteApprovalRequest(options, approvalMatch[1], response);
      return;
    }
  }

  if (request.method === "GET" && url === "/risk-notices") {
    handleListRiskNotices(options, response);
    return;
  }
  if (request.method === "POST" && url === "/risk-notices") {
    void handleCreateRiskNotice(options, request, response);
    return;
  }
  const riskMatch = url.match(/^\/risk-notices\/([^/]+)$/);
  if (riskMatch && request.method === "DELETE") {
    handleDeleteRiskNotice(options, riskMatch[1], response);
    return;
  }

  if (request.method === "GET" && url === "/trust-grants") {
    handleListTrustGrants(options, response);
    return;
  }
  if (request.method === "POST" && url === "/trust-grants") {
    void handleCreateTrustGrant(options, request, response);
    return;
  }
  const trustRevokeMatch = url.match(/^\/trust-grants\/([^/]+)\/revoke$/);
  if (trustRevokeMatch && request.method === "POST") {
    handleRevokeTrustGrant(options, trustRevokeMatch[1], response);
    return;
  }
  const trustMatch = url.match(/^\/trust-grants\/([^/]+)$/);
  if (trustMatch && request.method === "DELETE") {
    handleDeleteTrustGrant(options, trustMatch[1], response);
    return;
  }

  // ─── 备份管理 API ───
  if (request.method === "GET" && url === "/backups") {
    handleListBackups(options, response);
    return;
  }

  if (request.method === "POST" && url === "/backups") {
    void handleCreateBackup(options, request, response);
    return;
  }

  const backupMatch = url.match(/^\/backups\/([^/]+)\/restore$/);
  if (backupMatch && request.method === "POST") {
    handleRestoreBackup(options, backupMatch[1], response);
    return;
  }

  const backupDeleteMatch = url.match(/^\/backups\/([^/]+)$/);
  if (backupDeleteMatch && request.method === "DELETE") {
    handleDeleteBackup(options, backupDeleteMatch[1], response);
    return;
  }

  sendJson(response, 404, { status: "not-found" });
}

function requiresProxyAuth(url: string): boolean {
  return url.startsWith("/v1/") || url.startsWith("/v1beta/");
}

function requiresAdminAuth(url: string): boolean {
  return !requiresProxyAuth(url) && url !== "/health";
}

function isAuthorizedProxyRequest(request: IncomingMessage, expectedKey: string | undefined): boolean {
  if (!expectedKey) {
    return true;
  }
  const xApiKey = headerValue(request.headers["x-api-key"]);
  const authorization = headerValue(request.headers.authorization);
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  return xApiKey === expectedKey || bearer === expectedKey;
}

function isAuthorizedAdminRequest(
  request: IncomingMessage,
  adminAccessKey: string | undefined,
  proxyAccessKey: string | undefined,
): boolean {
  const expected = adminAccessKey ?? proxyAccessKey;
  if (!expected) {
    return true;
  }
  return isAuthorizedRequestByKey(request, expected);
}

function isAuthorizedRequestByKey(request: IncomingMessage, expectedKey: string | undefined): boolean {
  if (!expectedKey) {
    return true;
  }
  const xApiKey = headerValue(request.headers["x-api-key"]);
  const authorization = headerValue(request.headers.authorization);
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  return xApiKey === expectedKey || bearer === expectedKey;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

function handleListModels(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "channelStore">,
  response: ServerResponse,
): void {
  const active = options.providerProfiles.getActiveProviderProfile();
  const channelModels = (options.channelStore?.listChannels() ?? [])
    .flatMap((channel) => channel.supportedModels ?? [])
    .filter((model) => model && model.trim().length > 0);
  const modelSet = new Set<string>(channelModels);
  if (active?.targetModel) {
    modelSet.add(active.targetModel);
  }
  const now = Math.floor(Date.now() / 1000);
  const models = [...modelSet].sort().map((id) => ({
    id,
    object: "model",
    created: now,
    owned_by: "agentsoul-gateway",
  }));
  sendJson(response, 200, {
    object: "list",
    data: models,
  });
}

async function handleRouteFromOpenAIChat(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const clientRequest: GatewayClientRequest = {
    clientProtocol: "openai-chat",
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages: Array.isArray(body.messages) ? (body.messages as Array<{ role: string; content: string }>) : [],
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };
  handleClientRoute(options, clientRequest, response);
}

async function handleRouteFromCodexResponses(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const rawInput = body.input;
  const messages = Array.isArray(rawInput)
    ? (rawInput as Array<{ role: string; content: string }>)
    : [];
  const clientRequest: GatewayClientRequest = {
    clientProtocol: "codex-responses",
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };
  handleClientRoute(options, clientRequest, response);
}

async function handleRouteFromClaudeMessages(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const rawMessages = body.messages;
  const messages = Array.isArray(rawMessages)
    ? (rawMessages as Array<{ role: string; content: string }>)
    : [];
  const clientRequest: GatewayClientRequest = {
    clientProtocol: "claude-messages",
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };
  handleClientRoute(options, clientRequest, response);
}

async function handleRouteFromOpenAIImages(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
  operation: "generations" | "edits" | "variations",
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const clientRequest: GatewayClientRequest = {
    clientProtocol: "openai-images",
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages: [],
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
    },
    adapterMetadata: {
      operation,
      rawBody: body,
    },
  };
  handleClientRoute(options, clientRequest, response);
}

async function handleRouteHttp(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const clientRequest = (await readJsonBody(request)) as GatewayClientRequest;
  handleClientRoute(options, clientRequest, response);
}

function handleClientRoute(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  clientRequest: GatewayClientRequest,
  response: ServerResponse,
): void {
  const startedAt = Date.now();
  const failoverPolicy = loadFailoverPolicy(options.controlPlaneStore);
  const routedByChannel = routeThroughChannels(options.channelStore, clientRequest, failoverPolicy);
  const active = routedByChannel?.profile ?? options.providerProfiles.getActiveProviderProfile();

  if (!active) {
    options.audit?.recordAudit({
      trafficMetadata: createTrafficMetadata({
        active,
        clientRequest,
        startedAt,
        outcome: "no-active-provider-profile",
      }),
      estimatedCost: 0,
      outcome: "no-active-provider-profile",
    });
    sendJson(response, 409, {
      status: "no-active-provider-profile",
      liveProviderCallRequired: false,
    });
    return;
  }

  const route = routedByChannel?.route ?? translateGatewayRoute(active, clientRequest);
  const outcome = route.status;
  const latencyMs = Date.now() - startedAt;
  if (options.channelStore && routedByChannel?.channelId) {
    const inputTokens = normalizeTokenCount(clientRequest.tokenUsage?.inputTokens);
    const outputTokens = normalizeTokenCount(clientRequest.tokenUsage?.outputTokens);
    const success = outcome === "translated";
    options.channelStore.recordRequest(routedByChannel.channelId, {
      success,
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCost: success ? estimateTrafficCost(active, clientRequest) : 0,
      failoverThreshold: failoverPolicy.failoverThreshold,
    });
  }

  options.audit?.recordAudit({
    trafficMetadata: createTrafficMetadata({
      active,
      clientRequest,
      startedAt,
      outcome,
    }),
    estimatedCost: estimateTrafficCost(active, clientRequest),
    outcome,
  });

  sendJson(response, route.status === "translated" ? 200 : 422, route);
}

function routeThroughChannels(
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

function loadFailoverPolicy(controlPlaneStore: ControlPlaneStore | undefined): FailoverPolicy {
  const settings = controlPlaneStore?.settings.load();
  return {
    autoFailover: settings?.autoFailover ?? true,
    failoverThreshold: Math.max(1, Number(settings?.failoverThreshold ?? 5)),
    circuitBreakerTimeoutSeconds: Math.max(1, Number(settings?.circuitBreakerTimeout ?? 60)),
  };
}

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

export function createGatewayAuditRepository(options: { dbPath: string }): GatewayAuditRepository {
  initializeV2Database(options.dbPath);

  const db = new Database(options.dbPath);

  return {
    recordAudit(input) {
      const record: GatewayAuditRecord = {
        id: randomUUID(),
        gatewayEventId: input.trafficMetadata.gatewayEventId,
        trafficMetadata: input.trafficMetadata,
        estimatedCost: input.estimatedCost,
        outcome: input.outcome,
        evidenceHash: input.evidenceHash,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
      };

      db.prepare(
        `INSERT INTO audit_records (
           id,
           gateway_event_id,
           traffic_metadata_json,
           estimated_cost,
           outcome,
           evidence_hash,
           occurred_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.id,
        record.gatewayEventId,
        JSON.stringify(record.trafficMetadata),
        record.estimatedCost,
        record.outcome,
        record.evidenceHash,
        record.occurredAt,
      );

      return record;
    },
    listAuditRecords() {
      return readAuditRecords(db);
    },
    summarizeCostTrends(input) {
      return summarizeCostTrends(readAuditRecords(db, input));
    },
    close() {
      db.close();
    },
  };
}

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

function readAuditRecords(
  db: Database.Database,
  window?: { from: string; to: string },
): GatewayAuditRecord[] {
  const rows = window
    ? db
        .prepare(
          `SELECT
             id,
             gateway_event_id,
             traffic_metadata_json,
             estimated_cost,
             outcome,
             evidence_hash,
             occurred_at
           FROM audit_records
           WHERE occurred_at >= ? AND occurred_at < ?
           ORDER BY occurred_at ASC, rowid ASC`,
        )
        .all(window.from, window.to)
    : db
        .prepare(
          `SELECT
             id,
             gateway_event_id,
             traffic_metadata_json,
             estimated_cost,
             outcome,
             evidence_hash,
             occurred_at
           FROM audit_records
           ORDER BY rowid ASC`,
        )
        .all();

  return (rows as Array<{
    id: string;
    gateway_event_id: string;
    traffic_metadata_json: string;
    estimated_cost: number;
    outcome: string;
    evidence_hash: string | null;
    occurred_at: string;
  }>).map((row) => ({
    id: row.id,
    gatewayEventId: row.gateway_event_id,
    trafficMetadata: JSON.parse(row.traffic_metadata_json) as TrafficMetadata,
    estimatedCost: row.estimated_cost,
    outcome: row.outcome,
    evidenceHash: row.evidence_hash ?? undefined,
    occurredAt: row.occurred_at,
  }));
}

function summarizeCostTrends(records: GatewayAuditRecord[]): GatewayCostTrends {
  const daily = new Map<
    string,
    {
      estimatedCost: number;
      inputTokens: number;
      outputTokens: number;
      requestCount: number;
      latencyMs: number;
    }
  >();
  const modelMix = new Map<string, { requestCount: number; estimatedCost: number }>();
  const providerMix = new Map<string, { requestCount: number; estimatedCost: number }>();

  for (const record of records) {
    const date = record.occurredAt.slice(0, 10);
    const dailyEntry = daily.get(date) ?? {
      estimatedCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
      latencyMs: 0,
    };
    dailyEntry.estimatedCost += record.estimatedCost;
    dailyEntry.inputTokens += record.trafficMetadata.inputTokens;
    dailyEntry.outputTokens += record.trafficMetadata.outputTokens;
    dailyEntry.requestCount += 1;
    dailyEntry.latencyMs += record.trafficMetadata.latencyMs;
    daily.set(date, dailyEntry);

    const model = record.trafficMetadata.model ?? "unknown";
    const modelEntry = modelMix.get(model) ?? { requestCount: 0, estimatedCost: 0 };
    modelEntry.requestCount += 1;
    modelEntry.estimatedCost += record.estimatedCost;
    modelMix.set(model, modelEntry);

    const providerProfileId = record.trafficMetadata.providerProfileId ?? "unknown";
    const providerEntry = providerMix.get(providerProfileId) ?? {
      requestCount: 0,
      estimatedCost: 0,
    };
    providerEntry.requestCount += 1;
    providerEntry.estimatedCost += record.estimatedCost;
    providerMix.set(providerProfileId, providerEntry);
  }

  return {
    dailyCosts: [...daily.entries()].map(([date, entry]) => ({
      date,
      estimatedCost: roundCost(entry.estimatedCost),
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      requestCount: entry.requestCount,
      averageLatencyMs: Math.round(entry.latencyMs / entry.requestCount),
    })),
    modelMix: sortCostMix(
      [...modelMix.entries()].map(([model, entry]) => ({
        model,
        requestCount: entry.requestCount,
        estimatedCost: roundCost(entry.estimatedCost),
      })),
    ),
    providerMix: sortCostMix(
      [...providerMix.entries()].map(([providerProfileId, entry]) => ({
        providerProfileId,
        requestCount: entry.requestCount,
        estimatedCost: roundCost(entry.estimatedCost),
      })),
    ),
  };
}

function sortCostMix<T extends { estimatedCost: number }>(entries: T[]): T[] {
  return entries.sort((left, right) => right.estimatedCost - left.estimatedCost);
}

function roundCost(value: number): number {
  return Number(value.toFixed(8));
}

function createTrafficMetadata(input: {
  active: StoredProviderProfile | undefined;
  clientRequest: GatewayClientRequest;
  startedAt: number;
  outcome: string;
}): TrafficMetadata {
  const inputTokens = normalizeTokenCount(input.clientRequest.tokenUsage?.inputTokens);
  const outputTokens = normalizeTokenCount(input.clientRequest.tokenUsage?.outputTokens);

  return {
    gatewayEventId: randomUUID(),
    clientProtocol: input.clientRequest.clientProtocol,
    providerProtocol: input.active?.providerProtocol,
    providerProfileId: input.active ? String(input.active.id) : undefined,
    model: input.active?.targetModel,
    route: input.active
      ? `${input.clientRequest.clientProtocol} -> ${input.active.providerProtocol}`
      : `${input.clientRequest.clientProtocol} -> none`,
    inputTokens,
    outputTokens,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    outcome: input.outcome,
  };
}

function estimateTrafficCost(
  active: StoredProviderProfile | undefined,
  clientRequest: GatewayClientRequest,
): number {
  const inputTokens = normalizeTokenCount(clientRequest.tokenUsage?.inputTokens);
  const outputTokens = normalizeTokenCount(clientRequest.tokenUsage?.outputTokens);
  const inputCost = inputTokens * (active?.pricing?.inputTokenUsd ?? 0);
  const outputCost = outputTokens * (active?.pricing?.outputTokenUsd ?? 0);

  return Number((inputCost + outputCost).toFixed(8));
}

function normalizeTokenCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function createGatewayHealth(active: StoredProviderProfile | undefined): GatewayHealth {
  return {
    status: "ok",
    routeReady: Boolean(active),
    activeProviderProfile: active ? summarizeProviderProfile(active) : null,
    liveProviderCallRequired: false,
  };
}

function summarizeProviderProfile(profile: StoredProviderProfile): GatewayProviderProfileSummary {
  return {
    id: String(profile.id),
    name: profile.name,
    activationMode: profile.activationMode,
    credentialRef: profile.credentialRef ? String(profile.credentialRef) : undefined,
    clientProtocol: profile.clientProtocol,
    providerProtocol: profile.providerProtocol,
    targetModel: profile.targetModel,
    endpoint: profile.endpoint,
  };
}



// ─── 渠道管理 HTTP 处理函数 ───

function handleListChannels(
  options: Pick<LocalGatewayOptions, "channelStore">,
  response: ServerResponse,
): void {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  const channels = options.channelStore.listChannels();
  sendJson(response, 200, { channels });
}

async function handleCreateChannel(
  options: Pick<LocalGatewayOptions, "channelStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request);
    const channel = options.channelStore.createChannel(body as any);
    sendJson(response, 201, { channel });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleGetChannel(
  options: Pick<LocalGatewayOptions, "channelStore">,
  channelId: string,
  response: ServerResponse,
): void {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  const channel = options.channelStore.getChannel(channelId);
  if (!channel) {
    sendJson(response, 404, { error: "Channel not found" });
    return;
  }
  sendJson(response, 200, { channel });
}

async function handleUpdateChannel(
  options: Pick<LocalGatewayOptions, "channelStore">,
  channelId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request);
    const channel = options.channelStore.updateChannel(channelId, body as any);
    sendJson(response, 200, { channel });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleDeleteChannel(
  options: Pick<LocalGatewayOptions, "channelStore">,
  channelId: string,
  response: ServerResponse,
): void {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  try {
    options.channelStore.deleteChannel(channelId);
    sendJson(response, 204, null);
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleGetChannelMetrics(
  options: Pick<LocalGatewayOptions, "channelStore">,
  channelId: string,
  response: ServerResponse,
): void {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  const metrics = options.channelStore.getChannelMetrics(channelId);
  if (!metrics) {
    sendJson(response, 404, { error: "Channel metrics not found" });
    return;
  }
  sendJson(response, 200, { metrics });
}

async function handlePingChannel(
  options: Pick<LocalGatewayOptions, "channelStore">,
  channelId: string,
  response: ServerResponse,
): Promise<void> {
  if (!options.channelStore) {
    sendJson(response, 503, { error: "Channel store not configured" });
    return;
  }
  const channel = options.channelStore.getChannel(channelId);
  if (!channel) {
    sendJson(response, 404, { error: "Channel not found" });
    return;
  }

  const startedAt = Date.now();
  try {
    const ping = await pingUrlHead(channel.baseUrl, 5000);
    const latencyMs = Date.now() - startedAt;
    sendJson(response, 200, {
      channelId,
      reachable: ping.ok,
      statusCode: ping.status,
      latencyMs,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startedAt;
    sendJson(response, 200, {
      channelId,
      reachable: false,
      statusCode: 0,
      latencyMs,
      error: error?.message || "Connection failed",
      checkedAt: new Date().toISOString(),
    });
  }
}

function handleGetCostSummary(
  options: Pick<LocalGatewayOptions, "costTracker">,
  response: ServerResponse,
): void {
  if (!options.costTracker) {
    sendJson(response, 503, { error: "Cost tracker not configured" });
    return;
  }
  const summary = options.costTracker.getSummary();
  sendJson(response, 200, { summary });
}

function handleGetDashboard(
  options: Pick<LocalGatewayOptions, "channelStore" | "costTracker" | "providerProfiles">,
  response: ServerResponse,
): void {
  const channels = options.channelStore?.listChannels() ?? [];
  const metrics = options.channelStore?.listChannelMetrics() ?? [];
  const costSummary = options.costTracker?.getSummary();
  const health = createGatewayHealth(options.providerProfiles.getActiveProviderProfile());

  sendJson(response, 200, {
    channels,
    metrics,
    costSummary,
    gatewayHealth: health,
  });
}

function handleGetAppSettings(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const settings = options.controlPlaneStore.settings.load();
  sendJson(response, 200, { settings });
}

async function handleUpdateAppSettings(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const settings = (body.settings ?? body) as Record<string, unknown>;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      sendJson(response, 400, { error: "Invalid settings payload" });
      return;
    }
    options.controlPlaneStore.settings.save(settings as any);
    sendJson(response, 200, { settings });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleListPrompts(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const prompts = options.controlPlaneStore.prompts.list();
  sendJson(response, 200, { prompts });
}

async function handleCreatePrompt(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!name || !content) {
      sendJson(response, 400, { error: "name and content are required" });
      return;
    }
    const now = new Date().toISOString();
    const prompt = {
      id: `prompt-${randomUUID().slice(0, 8)}`,
      name,
      nameZh: typeof body.nameZh === "string" ? body.nameZh : undefined,
      content,
      category: typeof body.category === "string" ? body.category : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : undefined,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    options.controlPlaneStore.prompts.save(prompt);
    sendJson(response, 201, { prompt });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

async function handleTogglePromptFavorite(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  promptId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const prompts = options.controlPlaneStore.prompts.list();
  const found = prompts.find((prompt) => prompt.id === promptId);
  if (!found) {
    sendJson(response, 404, { error: "Prompt not found" });
    return;
  }
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const isFavorite =
      typeof body.isFavorite === "boolean"
        ? body.isFavorite
        : !found.isFavorite;
    const updated = {
      ...found,
      isFavorite,
      updatedAt: new Date().toISOString(),
    };
    options.controlPlaneStore.prompts.save(updated);
    sendJson(response, 200, { prompt: updated });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleDeletePrompt(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  promptId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  options.controlPlaneStore.prompts.delete(promptId);
  sendJson(response, 204, null);
}

function handleGetSkillsState(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const skills = options.controlPlaneStore.skillsState.load();
  sendJson(response, 200, { skills });
}

async function handleUpdateSkillsState(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const skills = (body.skills ?? body) as Record<string, unknown>;
    if (!skills || typeof skills !== "object" || Array.isArray(skills)) {
      sendJson(response, 400, { error: "Invalid skills payload" });
      return;
    }
    options.controlPlaneStore.skillsState.save(skills as any);
    sendJson(response, 200, { skills });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

// ─── MCP 服务器管理 HTTP 处理函数 ───

function handleListMcpServers(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const servers = options.controlPlaneStore.mcpServers.list();
  sendJson(response, 200, { servers });
}

async function handleCreateMcpServer(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { name: string; command: string; args?: string[]; env?: Record<string, string> };
    const id = `mcp-${randomUUID().slice(0, 8)}`;
    const server = {
      id,
      name: body.name,
      command: body.command,
      args: body.args,
      env: body.env,
      status: "stopped" as const,
    };
    options.controlPlaneStore.mcpServers.save(server);
    sendJson(response, 201, { server });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleToggleMcpServer(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  serverId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const servers = options.controlPlaneStore.mcpServers.list();
  const server = servers.find((s: any) => s.id === serverId);
  if (!server) {
    sendJson(response, 404, { error: "MCP server not found" });
    return;
  }
  const updated = {
    ...server,
    status: server.status === "running" ? "stopped" as const : "running" as const,
    lastStartedAt: server.status !== "running" ? new Date().toISOString() : server.lastStartedAt,
  };
  options.controlPlaneStore.mcpServers.save(updated);
  sendJson(response, 200, { server: updated });
}

function handleDeleteMcpServer(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  serverId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  options.controlPlaneStore.mcpServers.delete(serverId);
  sendJson(response, 204, null);
}

// ─── 会话管理 HTTP 处理函数 ───

function handleListSessions(
  options: Pick<LocalGatewayOptions, "sessionRepository">,
  response: ServerResponse,
): void {
  if (!options.sessionRepository) {
    sendJson(response, 200, { sessions: [] });
    return;
  }
  const rows = options.sessionRepository.listWorkSessions();
  const sessions = rows.map((row: any) => {
    const meta = JSON.parse(row.session_json || "{}");
    return {
      id: row.id,
      provider: row.source,
      projectDir: row.project_path,
      summary: meta.summary || "",
      lastActiveAt: row.last_active_at,
      messageCount: meta.messageCount || 0,
      isResumable: row.resumable === 1,
      resumeCommand: meta.resumeCommand || "",
      filePath: meta.filePath || "",
      tags: meta.tags || [],
    };
  });
  sendJson(response, 200, { sessions });
}

function handleDeleteSession(
  options: Pick<LocalGatewayOptions, "sessionRepository">,
  sessionId: string,
  response: ServerResponse,
): void {
  if (!options.sessionRepository) {
    sendJson(response, 204, null);
    return;
  }
  options.sessionRepository.deleteWorkSession(sessionId);
  sendJson(response, 204, null);
}

function handleResumeSession(
  options: Pick<LocalGatewayOptions, "sessionRepository">,
  sessionId: string,
  response: ServerResponse,
): void {
  if (!options.sessionRepository) {
    sendJson(response, 503, { error: "Session repository not configured" });
    return;
  }
  const session = options.sessionRepository.getWorkSession(sessionId) as any;
  if (!session) {
    sendJson(response, 404, { error: "Session not found" });
    return;
  }
  if (!session.resumable) {
    sendJson(response, 400, { error: "Session is not resumable" });
    return;
  }

  const meta = JSON.parse(session.session_json || "{}");
  const resumeCommand = (meta.resumeCommand as string | undefined)?.trim();
  if (!resumeCommand) {
    sendJson(response, 400, { error: "No resume command available" });
    return;
  }

  // Execute the resume command via local shell
  const { exec } = require("node:child_process");
  const { existsSync } = require("node:fs");
  const cwdCandidate = typeof session.project_path === "string" && session.project_path.trim().length > 0
    ? session.project_path
    : undefined;
  const cwd = cwdCandidate && existsSync(cwdCandidate) ? cwdCandidate : undefined;
  exec(
    resumeCommand,
    { timeout: 5000, shell: true, cwd },
    (error: Error | null, stdout: string, stderr: string) => {
    if (error) {
      sendJson(response, 500, { resumed: false, error: error.message, stderr });
      return;
    }
    sendJson(response, 200, { resumed: true, stdout, stderr });
    },
  );
}

// ─── 安全审批 HTTP 处理函数 ───

function handleListApprovalRequests(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 200, { approvalRequests: [] });
    return;
  }
  const approvalRequests = options.controlPlaneStore.safety.approvalRequests.list();
  sendJson(response, 200, { approvalRequests });
}

async function handleCreateApprovalRequest(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { title: string; message: string; actionRiskClass: string };
    const req = {
      id: `approval:${randomUUID().slice(0, 8)}`,
      title: body.title,
      message: body.message,
      actionRiskClass: body.actionRiskClass,
      createdAt: new Date().toISOString(),
      status: "Approval Required",
    };
    options.controlPlaneStore.safety.approvalRequests.save(req);
    sendJson(response, 201, { approvalRequest: req });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

async function handleUpdateApprovalStatus(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  requestId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { status: string };
    const ok = options.controlPlaneStore.safety.approvalRequests.updateStatus(requestId, body.status);
    if (!ok) {
      sendJson(response, 404, { error: "Approval request not found" });
      return;
    }
    sendJson(response, 200, { updated: true, id: requestId, status: body.status });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleDeleteApprovalRequest(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  requestId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 204, null);
    return;
  }
  options.controlPlaneStore.safety.approvalRequests.delete(requestId);
  sendJson(response, 204, null);
}

function handleListRiskNotices(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 200, { riskNotices: [] });
    return;
  }
  const riskNotices = options.controlPlaneStore.safety.riskNotices.list();
  sendJson(response, 200, { riskNotices });
}

async function handleCreateRiskNotice(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { message: string; clientAuthorizationMode: string };
    const notice = {
      id: `risk:${randomUUID().slice(0, 8)}`,
      message: body.message,
      observedAt: new Date().toISOString(),
      clientAuthorizationMode: body.clientAuthorizationMode,
    };
    options.controlPlaneStore.safety.riskNotices.save(notice);
    sendJson(response, 201, { riskNotice: notice });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleDeleteRiskNotice(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  noticeId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 204, null);
    return;
  }
  options.controlPlaneStore.safety.riskNotices.delete(noticeId);
  sendJson(response, 204, null);
}

function handleListTrustGrants(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 200, { trustGrants: [] });
    return;
  }
  const trustGrants = options.controlPlaneStore.safety.trustGrants.list();
  sendJson(response, 200, { trustGrants });
}

async function handleCreateTrustGrant(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { actionKinds: string[]; projectPath?: string; clientId?: string; maxRiskClass: string; expiresAt: string };
    const grant = {
      id: `trust:${randomUUID().slice(0, 8)}`,
      actionKinds: body.actionKinds,
      projectPath: body.projectPath,
      clientId: body.clientId,
      maxRiskClass: body.maxRiskClass,
      expiresAt: body.expiresAt,
    };
    options.controlPlaneStore.safety.trustGrants.save(grant);
    sendJson(response, 201, { trustGrant: grant });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleRevokeTrustGrant(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  grantId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const ok = options.controlPlaneStore.safety.trustGrants.revoke(grantId);
  if (!ok) {
    sendJson(response, 404, { error: "Trust grant not found" });
    return;
  }
  sendJson(response, 200, { revoked: true, id: grantId });
}

function handleDeleteTrustGrant(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  grantId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 204, null);
    return;
  }
  options.controlPlaneStore.safety.trustGrants.delete(grantId);
  sendJson(response, 204, null);
}

// ─── 备份管理 HTTP 处理函数 ───

function handleListBackups(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const backups = options.controlPlaneStore.backups.list();
  sendJson(response, 200, { backups });
}

async function handleCreateBackup(
  options: Pick<LocalGatewayOptions, "controlPlaneStore" | "channelStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  try {
    const body = await readJsonBody(request) as { name?: string; description?: string };
    const id = `backup-${randomUUID().slice(0, 8)}`;
    const name = body.name || `Backup ${new Date().toLocaleString()}`;

    // Serialize real control-plane state
    const mcpServers = options.controlPlaneStore.mcpServers.list();
    const appSettings = options.controlPlaneStore.settings.load();
    const channels = options.channelStore?.listChannels() ?? [];
    const snapshotJson = JSON.stringify({
      createdAt: new Date().toISOString(),
      name,
      description: body.description,
      channels,
      mcpServers,
      appSettings,
    });

    options.controlPlaneStore.backups.create({ id, name, snapshotJson });
    const backups = options.controlPlaneStore.backups.list();
    const entry = backups.find((b: any) => b.id === id);
    sendJson(response, 201, { backup: entry });
  } catch (error) {
    sendJson(response, 400, { error: String(error) });
  }
}

function handleRestoreBackup(
  options: Pick<LocalGatewayOptions, "controlPlaneStore" | "channelStore">,
  backupId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  const backups = options.controlPlaneStore.backups.list();
  const backup = backups.find((b: any) => b.id === backupId);
  if (!backup) {
    sendJson(response, 404, { error: "Backup not found" });
    return;
  }

  const snapshot = JSON.parse(backup.snapshotJson);

  // Restore channels
  if (snapshot.channels && Array.isArray(snapshot.channels) && options.channelStore) {
    const existingChannels = options.channelStore.listChannels();
    for (const ch of existingChannels) {
      options.channelStore.deleteChannel(ch.id);
    }
    for (const ch of snapshot.channels) {
      options.channelStore.createChannel({
        name: ch.name,
        type: ch.type,
        baseUrl: ch.baseUrl,
        apiKeys: ch.apiKeys || [],
        description: ch.description,
        priority: ch.priority ?? 0,
        supportedModels: ch.supportedModels || [],
        modelMapping: ch.modelMapping || {},
        customHeaders: ch.customHeaders || {},
        proxyUrl: ch.proxyUrl,
      });
    }
  }

  // Restore MCP servers
  if (snapshot.mcpServers && Array.isArray(snapshot.mcpServers)) {
    const current = options.controlPlaneStore.mcpServers.list();
    for (const s of current) {
      options.controlPlaneStore.mcpServers.delete(s.id);
    }
    for (const s of snapshot.mcpServers) {
      options.controlPlaneStore.mcpServers.save(s);
    }
  }

  // Restore settings
  if (snapshot.appSettings) {
    options.controlPlaneStore.settings.save(snapshot.appSettings);
  }

  sendJson(response, 200, { restored: true, backupId });
}

function handleDeleteBackup(
  options: Pick<LocalGatewayOptions, "controlPlaneStore">,
  backupId: string,
  response: ServerResponse,
): void {
  if (!options.controlPlaneStore) {
    sendJson(response, 503, { error: "Control plane store not configured" });
    return;
  }
  options.controlPlaneStore.backups.delete(backupId);
  sendJson(response, 204, null);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

// ─── 渠道管理 (仿照 CCX) ───

export type ChannelType = "claude" | "codex" | "openai" | "gemini";
export type ChannelStatus = "active" | "suspended" | "disabled" | "healthy" | "error";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority: number;
  status: ChannelStatus;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMetrics {
  channelId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  lastRequestAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  circuitState: "closed" | "open" | "half_open";
  consecutiveFailures: number;
}

export interface ChannelCreateInput {
  name: string;
  type: ChannelType;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority?: number;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
}

export interface ChannelUpdateInput {
  name?: string;
  baseUrl?: string;
  apiKeys?: string[];
  description?: string;
  priority?: number;
  status?: ChannelStatus;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
}

export interface ChannelStore {
  createChannel(input: ChannelCreateInput): Channel;
  getChannel(id: string): Channel | null;
  listChannels(type?: ChannelType): Channel[];
  updateChannel(id: string, input: ChannelUpdateInput): Channel;
  deleteChannel(id: string): void;
  getChannelMetrics(id: string): ChannelMetrics | null;
  listChannelMetrics(): ChannelMetrics[];
  recordRequest(channelId: string, input: {
    success: boolean;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    failoverThreshold?: number;
  }): void;
  close(): void;
}

interface FailoverPolicy {
  autoFailover: boolean;
  failoverThreshold: number;
  circuitBreakerTimeoutSeconds: number;
}

// ─── 成本统计 (多渠道聚合) ───

export interface CostSummary {
  totalEstimatedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byChannel: Array<{
    channelId: string;
    channelName: string;
    channelType: ChannelType;
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    successRate: number;
  }>;
  byModel: Array<{
    model: string;
    estimatedCost: number;
    requestCount: number;
  }>;
  dailyTrend: Array<{
    date: string;
    estimatedCost: number;
    requestCount: number;
  }>;
}

export interface CostTracker {
  getSummary(from?: string, to?: string): CostSummary;
  getChannelSummary(channelId: string, from?: string, to?: string): CostSummary;
  close(): void;
}

// ─── Channel Store 实现 ───

function rowToChannel(row: any): Channel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    apiKeys: JSON.parse(row.api_keys || '[]'),
    description: row.description,
    priority: row.priority,
    status: row.status,
    supportedModels: JSON.parse(row.supported_models || '[]'),
    modelMapping: JSON.parse(row.model_mapping || '{}'),
    customHeaders: JSON.parse(row.custom_headers || '{}'),
    proxyUrl: row.proxy_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMetrics(row: any): ChannelMetrics {
  return {
    channelId: row.channel_id,
    requestCount: row.request_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    successRate: row.request_count > 0 ? (row.success_count / row.request_count) * 100 : 0,
    averageLatencyMs: row.request_count > 0 ? row.total_latency_ms / row.request_count : 0,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    estimatedCost: row.estimated_cost,
    lastRequestAt: row.last_request_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    circuitState: row.circuit_state,
    consecutiveFailures: row.consecutive_failures,
  };
}

export function createChannelStore(options: { dbPath: string }): ChannelStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);

  // 创建渠道表
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_keys TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      supported_models TEXT,
      model_mapping TEXT,
      custom_headers TEXT,
      proxy_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 创建渠道指标表
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_metrics (
      channel_id TEXT PRIMARY KEY,
      request_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      total_latency_ms INTEGER DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      estimated_cost REAL DEFAULT 0,
      last_request_at TEXT,
      last_success_at TEXT,
      last_failure_at TEXT,
      circuit_state TEXT DEFAULT 'closed',
      consecutive_failures INTEGER DEFAULT 0,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    )
  `);

  return {
    createChannel(input) {
      const id = `ch-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO channels (id, name, type, base_url, api_keys, description, priority, status, supported_models, model_mapping, custom_headers, proxy_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.name, input.type, input.baseUrl,
        JSON.stringify(input.apiKeys), input.description || null,
        input.priority || 0, JSON.stringify(input.supportedModels || []),
        JSON.stringify(input.modelMapping || {}), JSON.stringify(input.customHeaders || {}),
        input.proxyUrl || null, now, now
      );

      // 初始化指标
      db.prepare(`
        INSERT INTO channel_metrics (channel_id) VALUES (?)
      `).run(id);

      return this.getChannel(id)!;
    },

    getChannel(id) {
      const row = db.prepare(`
        SELECT * FROM channels WHERE id = ?
      `).get(id);
      
      if (!row) return null;
      return rowToChannel(row);
    },

    listChannels(type) {
      let sql = 'SELECT * FROM channels';
      if (type) {
        sql += ' WHERE type = ?';
        const rows = db.prepare(sql).all(type);
        return rows.map(r => rowToChannel(r));
      }
      const rows = db.prepare(sql).all();
      return rows.map(r => rowToChannel(r));
    },

    updateChannel(id, input) {
      const channel = this.getChannel(id);
      if (!channel) throw new Error('Channel not found');

      const updates = [];
      const params = [];

      if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
      if (input.baseUrl !== undefined) { updates.push('base_url = ?'); params.push(input.baseUrl); }
      if (input.apiKeys !== undefined) { updates.push('api_keys = ?'); params.push(JSON.stringify(input.apiKeys)); }
      if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
      if (input.priority !== undefined) { updates.push('priority = ?'); params.push(input.priority); }
      if (input.status !== undefined) { updates.push('status = ?'); params.push(input.status); }
      if (input.supportedModels !== undefined) { updates.push('supported_models = ?'); params.push(JSON.stringify(input.supportedModels)); }
      if (input.modelMapping !== undefined) { updates.push('model_mapping = ?'); params.push(JSON.stringify(input.modelMapping)); }
      if (input.customHeaders !== undefined) { updates.push('custom_headers = ?'); params.push(JSON.stringify(input.customHeaders)); }
      if (input.proxyUrl !== undefined) { updates.push('proxy_url = ?'); params.push(input.proxyUrl); }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      db.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return this.getChannel(id)!;
    },

    deleteChannel(id) {
      db.prepare('DELETE FROM channel_metrics WHERE channel_id = ?').run(id);
      db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    },

    getChannelMetrics(id) {
      const row = db.prepare('SELECT * FROM channel_metrics WHERE channel_id = ?').get(id);
      if (!row) return null;
      return rowToMetrics(row);
    },

    listChannelMetrics() {
      const rows = db.prepare('SELECT * FROM channel_metrics').all();
      return rows.map(r => rowToMetrics(r));
    },

    recordRequest(channelId, input) {
      const now = new Date().toISOString();
      const metrics = this.getChannelMetrics(channelId);
      if (!metrics) return;
      const failoverThreshold = Math.max(1, Number(input.failoverThreshold ?? 5));

      const newRequestCount = metrics.requestCount + 1;
      const newSuccessCount = metrics.successCount + (input.success ? 1 : 0);
      const newFailureCount = metrics.failureCount + (input.success ? 0 : 1);
      const newConsecutiveFailures = input.success ? 0 : metrics.consecutiveFailures + 1;
      const newCircuitState = newConsecutiveFailures >= failoverThreshold ? 'open' : 'closed';

      db.prepare(`
        UPDATE channel_metrics SET
          request_count = ?, success_count = ?, failure_count = ?,
          total_latency_ms = total_latency_ms + ?,
          total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          estimated_cost = estimated_cost + ?,
          last_request_at = ?,
          last_${input.success ? 'success' : 'failure'}_at = ?,
          circuit_state = ?, consecutive_failures = ?
        WHERE channel_id = ?
      `).run(
        newRequestCount, newSuccessCount, newFailureCount,
        input.latencyMs, input.inputTokens, input.outputTokens,
        input.estimatedCost, now, now, newCircuitState, newConsecutiveFailures,
        channelId
      );
    },



    close() {
      db.close();
    },
  };
}

// ─── Cost Tracker 实现 ───

export function createCostTracker(options: {
  channelStore: ChannelStore;
  audit?: GatewayAuditRepository;
}): CostTracker {
  const getWindow = (from?: string, to?: string): { from: string; to: string } => ({
    from: from ?? "1970-01-01T00:00:00.000Z",
    to: to ?? "9999-12-31T23:59:59.999Z",
  });

  const getAuditTrends = (from?: string, to?: string): GatewayCostTrends => {
    if (!options.audit) {
      return { dailyCosts: [], modelMix: [], providerMix: [] };
    }
    const window = getWindow(from, to);
    return options.audit.summarizeCostTrends(window);
  };

  return {
    getSummary(from, to) {
      const channels = options.channelStore.listChannels();
      const metrics = options.channelStore.listChannelMetrics();
      const trends = getAuditTrends(from, to);

      const byChannel = channels.map(ch => {
        const m = metrics.find(m => m.channelId === ch.id);
        return {
          channelId: ch.id,
          channelName: ch.name,
          channelType: ch.type,
          estimatedCost: m?.estimatedCost || 0,
          inputTokens: m?.totalInputTokens || 0,
          outputTokens: m?.totalOutputTokens || 0,
          requestCount: m?.requestCount || 0,
          successRate: m?.successRate || 0,
        };
      });

      const totalEstimatedCost = byChannel.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalInputTokens = byChannel.reduce((sum, c) => sum + c.inputTokens, 0);
      const totalOutputTokens = byChannel.reduce((sum, c) => sum + c.outputTokens, 0);
      const totalRequests = byChannel.reduce((sum, c) => sum + c.requestCount, 0);

      return {
        totalEstimatedCost,
        totalInputTokens,
        totalOutputTokens,
        totalRequests,
        byChannel,
        byModel: trends.modelMix.map((item) => ({
          model: item.model,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
        dailyTrend: trends.dailyCosts.map((item) => ({
          date: item.date,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
      };
    },

    getChannelSummary(channelId, from, to) {
      const channel = options.channelStore.getChannel(channelId);
      if (!channel) throw new Error('Channel not found');

      const metrics = options.channelStore.getChannelMetrics(channelId);
      const trends = getAuditTrends(from, to);
      return {
        totalEstimatedCost: metrics?.estimatedCost || 0,
        totalInputTokens: metrics?.totalInputTokens || 0,
        totalOutputTokens: metrics?.totalOutputTokens || 0,
        totalRequests: metrics?.requestCount || 0,
        byChannel: [{
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          estimatedCost: metrics?.estimatedCost || 0,
          inputTokens: metrics?.totalInputTokens || 0,
          outputTokens: metrics?.totalOutputTokens || 0,
          requestCount: metrics?.requestCount || 0,
          successRate: metrics?.successRate || 0,
        }],
        byModel: trends.modelMix.map((item) => ({
          model: item.model,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
        dailyTrend: trends.dailyCosts.map((item) => ({
          date: item.date,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
      };
    },

    close() {},
  };
}
