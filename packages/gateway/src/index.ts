import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import { initializeV2Database } from "@agentsoul/persistence";
import type { ProviderProfileService, StoredProviderProfile } from "@agentsoul/provider";

export interface LocalGatewayOptions {
  providerProfiles: Pick<ProviderProfileService, "getActiveProviderProfile">;
  audit?: GatewayAuditRepository;
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
  messages?: Array<{ role: string; content: string }>;
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

const providerAdapters: ProviderAdapter[] = [OpenAICompatibleAdapter];

export async function startLocalGateway(options: LocalGatewayOptions): Promise<LocalGateway> {
  const host = options.host ?? "127.0.0.1";
  const server = createServer((request, response) => {
    routeRequest(options, request, response);
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

function routeRequest(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit">,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, createGatewayHealth(options.providerProfiles.getActiveProviderProfile()));
    return;
  }

  if (request.method === "POST" && request.url === "/route") {
    void handleRouteRequest(options, request, response);
    return;
  }

  sendJson(response, 404, {
    status: "not-found",
  });
}

async function handleRouteRequest(
  options: Pick<LocalGatewayOptions, "providerProfiles" | "audit">,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const startedAt = Date.now();
  const active = options.providerProfiles.getActiveProviderProfile();
  const clientRequest = (await readJsonBody(request)) as GatewayClientRequest;

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

  const route = translateGatewayRoute(active, clientRequest);
  const outcome = route.status;

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
