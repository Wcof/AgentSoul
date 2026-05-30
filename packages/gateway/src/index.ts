import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { ProviderProfileService, StoredProviderProfile } from "@agentsoul/provider";
import type { ControlPlaneStore } from "@agentsoul/persistence";
import { SessionRepository } from "@agentsoul/sessions";

// ─── Internal module imports ───

import { pingUrlHead } from "./channels/ping";
import { loadFailoverPolicy, routeThroughChannels } from "./channels/failover";
import { normalizeTokenCount, estimateTrafficCost } from "./cost/tracker";
import { translateGatewayRoute } from "./providers";
import { handleDirectCall } from "./direct-call";

// ─── Re-exports: providers ───

export type { ProviderAdapter, GatewayClientRequest, GatewayRouteResult, UnsupportedRouteResult } from "./providers";
export { OpenAICompatibleAdapter, CodexResponsesCompatibleAdapter, OpenAIImagesCompatibleAdapter, AnthropicMessagesCompatibleAdapter, translateGatewayRoute } from "./providers";

// ─── Re-exports: channels ───

export type { ChannelType, ChannelStatus, Channel, ChannelMetrics, ChannelCreateInput, ChannelUpdateInput, ChannelStore } from "./channels/store";
export { createChannelStore } from "./channels/store";

// ─── Re-exports: audit ───

export type { TrafficMetadata, GatewayAuditRecord, GatewayAuditRepository, GatewayCostTrends, DailyCostTrend, CostMixEntry, ProviderCostMixEntry } from "./audit/repository";
export { createGatewayAuditRepository } from "./audit/repository";

// ─── Re-exports: cost ───

export type { CostSummary, CostTracker } from "./cost/tracker";
export { createCostTracker, estimateTrafficCost, normalizeTokenCount } from "./cost/tracker";

// ─── Gateway entry-point types ───

export interface LocalGatewayOptions {
  providerProfiles: Pick<ProviderProfileService, "getActiveProviderProfile">;
  audit?: import("./audit/repository").GatewayAuditRepository;
  channelStore?: import("./channels/store").ChannelStore;
  costTracker?: import("./cost/tracker").CostTracker;
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

// ─── Gateway entry point ───

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

// ─── HTTP routing ───

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

  // ─── Direct-call endpoints (Gateway actually calls the LLM) ───

  if (request.method === "POST" && url === "/v1/direct/chat/completions") {
    void handleDirectCall(request, response, "openai-chat", { providerProfiles: options.providerProfiles });
    return;
  }
  if (request.method === "POST" && url === "/v1/direct/messages") {
    void handleDirectCall(request, response, "claude-messages", { providerProfiles: options.providerProfiles });
    return;
  }
  if (request.method === "POST" && url === "/v1/direct/responses") {
    void handleDirectCall(request, response, "codex-responses", { providerProfiles: options.providerProfiles });
    return;
  }

  // ─── Channel management API ───
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

  // ─── App settings API ───
  if (request.method === "GET" && url === "/settings") {
    handleGetAppSettings(options, response);
    return;
  }

  if (request.method === "PUT" && url === "/settings") {
    void handleUpdateAppSettings(options, request, response);
    return;
  }

  // ─── Skills state API ───
  if (request.method === "GET" && url === "/skills") {
    handleGetSkillsState(options, response);
    return;
  }
  if (request.method === "PUT" && url === "/skills") {
    void handleUpdateSkillsState(options, request, response);
    return;
  }

  // ─── Prompt template API ───
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

  // ─── MCP server management API ───
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

  // ─── Session management API ───
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

  // ─── Safety approval API ───
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

  // ─── Backup management API ───
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

// ─── Auth helpers ───

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

// ─── Health / profile helpers ───

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

function createTrafficMetadata(input: {
  active: StoredProviderProfile | undefined;
  clientRequest: import("./providers").GatewayClientRequest;
  startedAt: number;
  outcome: string;
}): import("./audit/repository").TrafficMetadata {
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

// ─── Model listing ───

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

// ─── Route handlers ───

async function handleRouteFromOpenAIChat(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const clientRequest: import("./providers").GatewayClientRequest = {
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
  const clientRequest: import("./providers").GatewayClientRequest = {
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
  const clientRequest: import("./providers").GatewayClientRequest = {
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
  const clientRequest: import("./providers").GatewayClientRequest = {
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
  const clientRequest = (await readJsonBody(request)) as import("./providers").GatewayClientRequest;
  handleClientRoute(options, clientRequest, response);
}

function handleClientRoute(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit" | "channelStore" | "controlPlaneStore">,
  clientRequest: import("./providers").GatewayClientRequest,
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

// ─── Channel management HTTP handlers ───

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

// ─── Cost summary HTTP handler ───

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

// ─── App settings HTTP handlers ───

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

// ─── Skills state HTTP handlers ───

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

// ─── Prompt template HTTP handlers ───

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

// ─── MCP server management HTTP handlers ───

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

// ─── Session management HTTP handlers ───

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

// ─── Safety approval HTTP handlers ───

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

// ─── Backup management HTTP handlers ───

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

// ─── HTTP utilities ───

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
