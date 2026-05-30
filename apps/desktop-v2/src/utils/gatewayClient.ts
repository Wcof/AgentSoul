// ═══════════════════════════════════════════════════════════════════════
// Gateway API Client — 连接 Gateway HTTP API 实现渠道 CRUD
// Business entities are NOT stored in localStorage.
// Use localControlClient.ts for unified control-plane access.
// ═══════════════════════════════════════════════════════════════════════

import type {
  CompanionRuntimeSnapshot,
  ChannelListItemViewModel,
  ChannelAddFormData,
  ChannelApiType,
  ChannelStatus,
  DashboardStatsSnapshot,
  SessionListItemViewModel,
  McpServerViewModel,
  PromptTemplateViewModel,
  AppSettingsSnapshot,
  BackupEntry,
} from "../types";

let gatewayBase = "http://127.0.0.1:0";

export function setGatewayBase(url: string): void {
  gatewayBase = url.replace(/\/$/, "");
}

export function getGatewayBase(): string {
  return gatewayBase;
}

// ─── 通用请求工具 ───

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${gatewayBase}${path}`;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `API ${method} ${path} failed: ${res.status}`);
  return json as T;
}

// ─── 渠道 CRUD (Gateway HTTP API) ───

export interface ChannelDTO {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority: number;
  status: string;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMetricsDTO {
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
  circuitState: "closed" | "open" | "half_open";
  consecutiveFailures: number;
}

function channelDTOtoVM(dto: ChannelDTO, metrics?: ChannelMetricsDTO): ChannelListItemViewModel {
  return {
    id: dto.id,
    name: dto.name,
    apiType: (dto.type as ChannelApiType) || "openai-chat",
    baseUrl: dto.baseUrl,
    priority: dto.priority,
    status: (dto.status as ChannelStatus) || "active",
    circuitState: metrics?.circuitState ?? "closed",
    requestCount: metrics?.requestCount ?? 0,
    successRate: metrics?.successRate ?? 100,
    averageLatencyMs: metrics?.averageLatencyMs ?? 0,
    totalInputTokens: metrics?.totalInputTokens ?? 0,
    totalOutputTokens: metrics?.totalOutputTokens ?? 0,
    estimatedCost: metrics?.estimatedCost ?? 0,
    description: dto.description,
    supportedModels: dto.supportedModels,
    consecutiveFailures: metrics?.consecutiveFailures ?? 0,
    lastRequestAt: metrics?.lastRequestAt,
  };
}

export async function fetchChannels(): Promise<ChannelListItemViewModel[]> {
  try {
    const { channels } = await api<{ channels: ChannelDTO[] }>("GET", "/channels");
    const metricsPromises = channels.map((ch) =>
      api<ChannelMetricsDTO>("GET", `/channels/${ch.id}/metrics`).catch(() => null),
    );
    const metricsResults = await Promise.all(metricsPromises);
    return channels.map((ch, i) => channelDTOtoVM(ch, metricsResults[i] ?? undefined));
  } catch {
    return [];
  }
}

export async function createChannel(data: ChannelAddFormData): Promise<ChannelListItemViewModel> {
  const { channel } = await api<{ channel: ChannelDTO }>("POST", "/channels", {
    name: data.name,
    type: data.apiType,
    baseUrl: data.baseUrl,
    apiKeys: data.apiKeys || [],
    description: data.description,
    priority: data.priority ?? 0,
    supportedModels: data.supportedModels || [],
    modelMapping: data.modelMapping || {},
    customHeaders: data.customHeaders || {},
    proxyUrl: data.proxyUrl,
  });
  return channelDTOtoVM(channel);
}

export async function updateChannel(id: string, data: Partial<ChannelAddFormData>): Promise<ChannelListItemViewModel> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.baseUrl !== undefined) payload.baseUrl = data.baseUrl;
  if (data.apiType !== undefined) payload.type = data.apiType;
  if (data.apiKeys !== undefined) payload.apiKeys = data.apiKeys;
  if (data.description !== undefined) payload.description = data.description;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.supportedModels !== undefined) payload.supportedModels = data.supportedModels;
  if (data.modelMapping !== undefined) payload.modelMapping = data.modelMapping;
  if (data.customHeaders !== undefined) payload.customHeaders = data.customHeaders;
  if (data.proxyUrl !== undefined) payload.proxyUrl = data.proxyUrl;

  const { channel } = await api<{ channel: ChannelDTO }>("PUT", `/channels/${id}`, payload);
  return channelDTOtoVM(channel);
}

export async function deleteChannel(id: string): Promise<void> {
  await api<void>("DELETE", `/channels/${id}`);
}

export async function fetchDashboardStats(): Promise<DashboardStatsSnapshot> {
  try {
    const data = await api<{
      channels: ChannelDTO[];
      metrics: ChannelMetricsDTO[];
    }>("GET", "/dashboard");

    const channels = data.channels || [];
    const metrics = data.metrics || [];
    const activeChannels = channels.filter((c) => c.status === "active").length;
    const totalRequests = metrics.reduce((s, m) => s + m.requestCount, 0);
    const totalEstimatedCost = metrics.reduce((s, m) => s + m.estimatedCost, 0);
    const totalInputTokens = metrics.reduce((s, m) => s + m.totalInputTokens, 0);
    const totalOutputTokens = metrics.reduce((s, m) => s + m.totalOutputTokens, 0);
    const successfulRequests = metrics.reduce((s, m) => s + m.successCount, 0);

    return {
      totalChannels: channels.length,
      activeChannels,
      totalRequests,
      totalEstimatedCost,
      overallSuccessRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
      totalInputTokens,
      totalOutputTokens,
    };
  } catch {
    return {
      totalChannels: 0, activeChannels: 0, totalRequests: 0,
      totalEstimatedCost: 0, overallSuccessRate: 100,
      totalInputTokens: 0, totalOutputTokens: 0,
    };
  }
}

// ─── Stub implementations for features not yet backed by authoritative store ───
// These return null/undefined so handlers gracefully degrade.
// Real implementations will route through localControlClient.ts when available.

export function createSession(_input: { provider: string; projectDir: string; summary?: string }): SessionListItemViewModel | null {
  return null;
}
export function deleteSession(_id: string): boolean {
  return false;
}
export function searchSessions(_keyword: string): SessionListItemViewModel[] {
  return [];
}

export function createMcpServer(_input: { name: string; command: string; args?: string[] }): McpServerViewModel | null {
  return null;
}
export function toggleMcpServer(_id: string): McpServerViewModel | null {
  return null;
}
export function deleteMcpServer(_id: string): boolean {
  return false;
}

export function createPrompt(_input: { name: string; nameZh?: string; content: string; category?: string; tags?: string[] }): PromptTemplateViewModel | null {
  return null;
}
export function togglePromptFavorite(_id: string): PromptTemplateViewModel | null {
  return null;
}
export function deletePrompt(_id: string): boolean {
  return false;
}

export function loadSettings(): AppSettingsSnapshot | null {
  return null;
}
export async function saveSettings(settings: AppSettingsSnapshot): Promise<void> {
  await api<{ settings: AppSettingsSnapshot }>("PUT", "/settings", { settings });
}
export function updateSetting(_key: string, _value: unknown): AppSettingsSnapshot | null {
  return null;
}

export function createBackup(_name?: string, _description?: string): BackupEntry | null {
  return null;
}
export function createAutoBackup(): BackupEntry | null {
  return null;
}
export function deleteBackup(_id: string): boolean {
  return false;
}
export function loadBackups(): BackupEntry[] {
  return [];
}

export function buildSnapshotFromLocal(base: CompanionRuntimeSnapshot): CompanionRuntimeSnapshot {
  return base;
}
export async function buildSnapshotFromGateway(base: CompanionRuntimeSnapshot): Promise<CompanionRuntimeSnapshot> {
  return base;
}
