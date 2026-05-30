// ═══════════════════════════════════════════════════════════════════════
// Local Control Client — 桌面端统一控制面抽象
// Abstracts between Tauri invoke and HTTP for authoritative state access.
// localStorage is NOT used for business entities here.
// ═══════════════════════════════════════════════════════════════════════

import type {
  CompanionRuntimeSnapshot,
  ChannelListItemViewModel,
  ChannelApiType,
  DashboardStatsSnapshot,
  McpServerViewModel,
  SessionListItemViewModel,
  BackupEntry,
  PromptTemplateViewModel,
  SkillsAreaSnapshot,
  AppSettingsSnapshot,
} from "../types";
import { defaultCompanionSnapshot } from "../renderers";

export interface ApprovalRequestVM {
  id: string;
  title: string;
  message: string;
  actionRiskClass: string;
  createdAt: string;
  status: string;
}

export interface RiskNoticeVM {
  id: string;
  message: string;
  observedAt: string;
  clientAuthorizationMode: string;
}

export interface TrustGrantVM {
  id: string;
  actionKinds: string[];
  projectPath?: string;
  clientId?: string;
  maxRiskClass: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface LocalControlClientOptions {
  gatewayBase: string;
  accessKey?: string;
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  fetchImpl?: typeof fetch;
}

export interface LocalControlClient {
  setAccessKey(accessKey?: string): void;
  loadSnapshot(): Promise<CompanionRuntimeSnapshot>;
  createChannel(input: ChannelCreateInput): Promise<ChannelListItemViewModel>;
  updateChannel(id: string, input: Partial<ChannelCreateInput>): Promise<ChannelListItemViewModel>;
  deleteChannel(id: string): Promise<void>;
  pingChannel(id: string): Promise<{ reachable: boolean; statusCode: number; latencyMs: number; error?: string }>;
  fetchDashboardStats(): Promise<DashboardStatsSnapshot>;
  createMcpServer(input: McpCreateInput): Promise<McpServerViewModel | null>;
  toggleMcpServer(id: string): Promise<McpServerViewModel | null>;
  deleteMcpServer(id: string): Promise<void>;
  listSessions(): Promise<SessionListItemViewModel[]>;
  resumeSession(id: string): Promise<{ success: boolean; message: string }>;
  deleteSession(id: string): Promise<void>;
  listBackups(): Promise<BackupEntry[]>;
  createBackup(name?: string, description?: string): Promise<BackupEntry | null>;
  deleteBackup(id: string): Promise<void>;
  restoreBackup(id: string): Promise<boolean>;
  listApprovalRequests(): Promise<ApprovalRequestVM[]>;
  approveRequest(id: string): Promise<boolean>;
  denyRequest(id: string): Promise<boolean>;
  listRiskNotices(): Promise<RiskNoticeVM[]>;
  listTrustGrants(): Promise<TrustGrantVM[]>;
  revokeTrustGrant(id: string): Promise<boolean>;
  listPrompts(): Promise<PromptTemplateViewModel[]>;
  createPrompt(input: { name: string; nameZh?: string; content: string; category?: string; tags?: string[] }): Promise<PromptTemplateViewModel | null>;
  togglePromptFavorite(id: string, isFavorite?: boolean): Promise<PromptTemplateViewModel | null>;
  deletePrompt(id: string): Promise<void>;
  getSkillsState(): Promise<SkillsAreaSnapshot | null>;
  saveSkillsState(skills: SkillsAreaSnapshot): Promise<boolean>;
  saveAppSettings(settings: AppSettingsSnapshot): Promise<boolean>;
}

export interface ChannelCreateInput {
  name: string;
  type: string;
  baseUrl: string;
  apiKeys?: string[];
  description?: string;
  priority?: number;
  status?: string;
  supportedModels?: string[];
}

export interface McpCreateInput {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpServerDTO {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status: "running" | "stopped";
  toolCount?: number;
  lastStartedAt?: string;
}

function mcpDTOtoVM(dto: McpServerDTO): McpServerViewModel {
  return {
    id: dto.id,
    name: dto.name,
    command: dto.command,
    args: dto.args,
    env: dto.env,
    status: dto.status,
    toolCount: dto.toolCount ?? 0,
    lastStartedAt: dto.lastStartedAt,
  };
}

interface GatewayChannelDTO {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority: number;
  status: string;
  supportedModels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface GatewayMetricsDTO {
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

interface GatewaySettingsDTO {
  settings: Record<string, unknown> | null;
}

interface PromptDTO {
  id: string;
  name: string;
  nameZh?: string;
  content: string;
  category?: string;
  tags?: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SkillsStateDTO {
  skills: SkillsAreaSnapshot | null;
}

function channelDTOtoVM(dto: GatewayChannelDTO, metrics?: GatewayMetricsDTO): ChannelListItemViewModel {
  return {
    id: dto.id,
    name: dto.name,
    apiType: (dto.type as ChannelApiType) || "openai-chat",
    baseUrl: dto.baseUrl,
    priority: dto.priority,
    status: (dto.status as any) || "active",
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

export function createLocalControlClient(options: LocalControlClientOptions): LocalControlClient {
  const fetchFn = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const base = options.gatewayBase.replace(/\/$/, "");
  let runtimeAccessKey = options.accessKey?.trim() || "";

  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${base}${path}`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (runtimeAccessKey.length > 0) {
      headers.authorization = `Bearer ${runtimeAccessKey}`;
    }
    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetchFn(url, init);
    if (res.status === 204) return undefined as T;
    const json = await (res as Response).json();
    if (!(res as Response).ok) throw new Error(json.error || `API ${method} ${path} failed: ${(res as Response).status}`);
    return json as T;
  }

  return {
    setAccessKey(accessKey?: string): void {
      runtimeAccessKey = accessKey?.trim() || "";
    },
    async loadSnapshot(): Promise<CompanionRuntimeSnapshot> {
      const emptySnapshot = structuredClone(defaultCompanionSnapshot);
      const channelVMs: ChannelListItemViewModel[] = [];
      try {
        const { channels } = await api<{ channels: GatewayChannelDTO[] }>("GET", "/channels");
        channelVMs.push(...channels.map((ch) => channelDTOtoVM(ch)));
      } catch {
        // Channels endpoint not available
      }

        let dashboardStats: DashboardStatsSnapshot;
        try {
          const dashData = await api<{
            channels: GatewayChannelDTO[];
            metrics: GatewayMetricsDTO[];
            costSummary?: any;
          }>("GET", "/dashboard");

          const metrics = dashData.metrics || [];
          const activeChannels = (dashData.channels || []).filter((c) => c.status === "active").length;
          const totalRequests = metrics.reduce((s, m) => s + m.requestCount, 0);
          const totalEstimatedCost = metrics.reduce((s, m) => s + m.estimatedCost, 0);
          const totalInputTokens = metrics.reduce((s, m) => s + m.totalInputTokens, 0);
          const totalOutputTokens = metrics.reduce((s, m) => s + m.totalOutputTokens, 0);
          const successfulRequests = metrics.reduce((s, m) => s + m.successCount, 0);

          dashboardStats = {
            totalChannels: channelVMs.length,
            activeChannels,
            totalRequests,
            totalEstimatedCost,
            overallSuccessRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
            totalInputTokens,
            totalOutputTokens,
          };
        } catch {
          dashboardStats = {
            totalChannels: channelVMs.length,
            activeChannels: channelVMs.filter((c) => c.status === "active").length,
            totalRequests: 0,
            totalEstimatedCost: 0,
            overallSuccessRate: 100,
            totalInputTokens: 0,
            totalOutputTokens: 0,
          };
        }

        // Load MCP servers from gateway
        let mcpServers: McpServerViewModel[] = [];
        try {
          const mcpData = await api<{ servers: McpServerDTO[] }>("GET", "/mcp-servers");
          mcpServers = (mcpData.servers || []).map(mcpDTOtoVM);
        } catch {
          // MCP endpoint not available
        }

        // Load sessions from gateway
        let localSessions: SessionListItemViewModel[] = [];
        try {
          const sessionData = await api<{ sessions: SessionListItemViewModel[] }>("GET", "/sessions");
          localSessions = sessionData.sessions || [];
        } catch {
          // Sessions endpoint not available
        }
        const sessions = {
          ...emptySnapshot.sessions,
          workSessions: localSessions.map((session) => ({
            id: session.id,
            source: "gateway-session-repository",
            client: session.provider,
            projectPath: session.projectDir,
            lastActiveAt: session.lastActiveAt,
            evidenceSummary: session.summary || "",
            searchable: true,
            resumable: !!session.isResumable,
            resumeCommand: session.resumeCommand,
          })),
        };
        const conversationDashboard = {
          conversations: localSessions.map((session) => ({
            id: session.id,
            kind: "chat" as const,
            title: session.summary?.trim() || session.projectDir,
            channelName: session.provider,
            status: session.isResumable ? ("active" as const) : ("idle" as const),
            messageCount: session.messageCount,
            lastActivityAt: session.lastActiveAt,
            startedAt: session.lastActiveAt,
            model: undefined,
            tokensUsed: undefined,
            estimatedCost: undefined,
          })),
          activeFilter: emptySnapshot.conversationDashboard.activeFilter,
          searchQuery: emptySnapshot.conversationDashboard.searchQuery,
          systemStatus: (dashboardStats.activeChannels > 0 ? "online" : "degraded") as "online" | "degraded" | "offline",
          overrideCount: channelVMs.filter((channel) => channel.status === "suspended").length,
        };

        let appSettings = emptySnapshot.appSettings;
        try {
          const settingsData = await api<GatewaySettingsDTO>("GET", "/settings");
          if (settingsData.settings && typeof settingsData.settings === "object") {
            appSettings = {
              ...appSettings,
              ...(settingsData.settings as Record<string, unknown>),
            } as typeof appSettings;
          }
        } catch {
          // Settings endpoint not available
        }

        let prompts: PromptTemplateViewModel[] = [];
        try {
          const promptsData = await api<{ prompts: PromptDTO[] }>("GET", "/prompts");
          prompts = (promptsData.prompts || []).map((prompt) => ({
            id: prompt.id,
            name: prompt.name,
            nameZh: prompt.nameZh,
            content: prompt.content,
            category: prompt.category,
            tags: prompt.tags,
            isFavorite: !!prompt.isFavorite,
            createdAt: prompt.createdAt,
            updatedAt: prompt.updatedAt,
          }));
        } catch {
          // Prompt endpoint not available
        }

        let skills = emptySnapshot.skills;
        try {
          const skillsData = await api<SkillsStateDTO>("GET", "/skills");
          if (skillsData.skills) {
            skills = skillsData.skills;
          }
        } catch {
          // Skills endpoint not available
        }

        let safety = emptySnapshot.safety;
        try {
          const [approvalData, riskData, trustData] = await Promise.all([
            api<{ approvalRequests: ApprovalRequestVM[] }>("GET", "/approval-requests").catch(() => ({ approvalRequests: [] })),
            api<{ riskNotices: RiskNoticeVM[] }>("GET", "/risk-notices").catch(() => ({ riskNotices: [] })),
            api<{ trustGrants: TrustGrantVM[] }>("GET", "/trust-grants").catch(() => ({ trustGrants: [] })),
          ]);
          safety = {
            ...safety,
            approvalRequests: (approvalData.approvalRequests || []).map((request) => ({
              id: request.id,
              title: request.title,
              message: request.message,
              actionRiskClass: (request.actionRiskClass as any) || "high-risk",
              createdAt: request.createdAt,
              status: (request.status as any) || "Approval Required",
            })),
            riskNotices: (riskData.riskNotices || []).map((notice) => ({
              id: notice.id,
              message: notice.message,
              observedAt: notice.observedAt,
              clientAuthorizationMode: (notice.clientAuthorizationMode as any) || "normal",
            })),
            scopedTrustGrants: (trustData.trustGrants || []).map((grant) => ({
              id: grant.id,
              actionKinds: grant.actionKinds || [],
              projectPath: grant.projectPath,
              clientId: grant.clientId,
              maxRiskClass: (grant.maxRiskClass as any) || "high-risk",
              expiresAt: grant.expiresAt,
              revokedAt: grant.revokedAt,
            })),
          };
        } catch {
          // Safety endpoint not available
        }

        let backupList = emptySnapshot.backupList;
        try {
          const backupData = await api<{ backups: Array<{ id: string; name: string; createdAt: string; sizeBytes: number; description?: string; isAuto?: boolean }> }>("GET", "/backups");
          backupList = {
            ...backupList,
            backups: (backupData.backups || []).map((entry) => ({
              id: entry.id,
              name: entry.name,
              createdAt: entry.createdAt,
              sizeBytes: entry.sizeBytes,
              description: entry.description,
              isAuto: !!entry.isAuto,
            })),
            autoBackupEnabled: appSettings.autoBackup,
            autoBackupInterval: appSettings.autoBackupInterval,
          };
        } catch {
          // Backup endpoint not available
        }

        const keyTrend = {
          ...emptySnapshot.keyTrend,
          summary: {
            ...emptySnapshot.keyTrend.summary,
            totalRequests: dashboardStats.totalRequests,
            avgSuccessRate: dashboardStats.overallSuccessRate,
            totalInputTokens: dashboardStats.totalInputTokens,
            totalOutputTokens: dashboardStats.totalOutputTokens,
          },
        };

        const modelStats = {
          ...emptySnapshot.modelStats,
          topModels: [...channelVMs]
            .sort((a, b) => b.requestCount - a.requestCount)
            .slice(0, 5)
            .map((channel) => ({ name: channel.name, count: channel.requestCount })),
          models: channelVMs.map((channel) => ({
            model: channel.supportedModels?.[0] || channel.name,
            requestCount: channel.requestCount,
            inputTokens: channel.totalInputTokens,
            outputTokens: channel.totalOutputTokens,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            successRate: channel.successRate,
            avgLatencyMs: channel.averageLatencyMs,
          })),
        };

        const appSwitcher = {
          ...emptySnapshot.appSwitcher,
          activeApp: "agentsoul" as const,
        };

        const usageFooter = {
          ...emptySnapshot.usageFooter,
          providerName: channelVMs[0]?.name || emptySnapshot.usageFooter.providerName,
          usage: {
            used: dashboardStats.totalInputTokens + dashboardStats.totalOutputTokens,
            total: 0,
            unit: "tokens",
            success: true,
          },
          lastQueriedAt: new Date().toISOString(),
        };

        return {
          ...emptySnapshot,
          channels: channelVMs,
          dashboardStats,
          keyTrend,
          modelStats,
          appSwitcher,
          usageFooter,
          backupList,
          sessions,
          safety,
          mcpServers,
          localSessions,
          conversationDashboard,
          skills,
          prompts,
          appSettings,
        };
    },

    async createChannel(input: ChannelCreateInput): Promise<ChannelListItemViewModel> {
      const { channel } = await api<{ channel: GatewayChannelDTO }>("POST", "/channels", {
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        apiKeys: input.apiKeys || [],
        description: input.description,
        priority: input.priority ?? 0,
        supportedModels: input.supportedModels || [],
      });
      return channelDTOtoVM(channel);
    },

    async updateChannel(id: string, input: Partial<ChannelCreateInput>): Promise<ChannelListItemViewModel> {
      const payload: Record<string, unknown> = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.baseUrl !== undefined) payload.baseUrl = input.baseUrl;
      if (input.type !== undefined) payload.type = input.type;
      if (input.apiKeys !== undefined) payload.apiKeys = input.apiKeys;
      if (input.description !== undefined) payload.description = input.description;
      if (input.priority !== undefined) payload.priority = input.priority;
      if (input.status !== undefined) payload.status = input.status;
      if (input.supportedModels !== undefined) payload.supportedModels = input.supportedModels;

      const { channel } = await api<{ channel: GatewayChannelDTO }>("PUT", `/channels/${id}`, payload);
      return channelDTOtoVM(channel);
    },

    async deleteChannel(id: string): Promise<void> {
      await api<void>("DELETE", `/channels/${id}`);
    },

    async pingChannel(id: string): Promise<{ reachable: boolean; statusCode: number; latencyMs: number; error?: string }> {
      try {
        const res = await api<{ reachable: boolean; statusCode: number; latencyMs: number; error?: string }>("POST", `/channels/${id}/ping`);
        return res;
      } catch (e: any) {
        return { reachable: false, statusCode: 0, latencyMs: 0, error: e?.message || "Ping failed" };
      }
    },

    async fetchDashboardStats(): Promise<DashboardStatsSnapshot> {
      try {
        const data = await api<{
          channels: GatewayChannelDTO[];
          metrics: GatewayMetricsDTO[];
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
    },

    async createMcpServer(input: McpCreateInput): Promise<McpServerViewModel | null> {
      try {
        const { server } = await api<{ server: McpServerDTO }>("POST", "/mcp-servers", {
          name: input.name,
          command: input.command,
          args: input.args,
          env: input.env,
        });
        return mcpDTOtoVM(server);
      } catch {
        return null;
      }
    },

    async toggleMcpServer(id: string): Promise<McpServerViewModel | null> {
      try {
        const { server } = await api<{ server: McpServerDTO }>("PUT", `/mcp-servers/${id}/toggle`);
        return mcpDTOtoVM(server);
      } catch {
        return null;
      }
    },

    async deleteMcpServer(id: string): Promise<void> {
      await api<void>("DELETE", `/mcp-servers/${id}`);
    },

    async listSessions(): Promise<SessionListItemViewModel[]> {
      try {
        const data = await api<{ sessions: SessionListItemViewModel[] }>("GET", "/sessions");
        return data.sessions || [];
      } catch {
        return [];
      }
    },

    async resumeSession(id: string): Promise<{ success: boolean; message: string }> {
      try {
        const res = await api<{ resumed: boolean; stdout?: string; stderr?: string; error?: string }>("POST", `/sessions/${id}/resume`);
        if (res.resumed) {
          return { success: true, message: res.stdout || "Session resumed" };
        }
        return { success: false, message: res.error || res.stderr || "Resume failed" };
      } catch (e: any) {
        return { success: false, message: e?.message || "Resume failed" };
      }
    },

    async deleteSession(id: string): Promise<void> {
      await api<void>("DELETE", `/sessions/${id}`);
    },

    async listBackups(): Promise<BackupEntry[]> {
      try {
        const data = await api<{ backups: BackupEntry[] }>("GET", "/backups");
        return data.backups || [];
      } catch {
        return [];
      }
    },

    async createBackup(name?: string, description?: string): Promise<BackupEntry | null> {
      try {
        const { backup } = await api<{ backup: BackupEntry }>("POST", "/backups", { name, description });
        return backup;
      } catch {
        return null;
      }
    },

    async deleteBackup(id: string): Promise<void> {
      await api<void>("DELETE", `/backups/${id}`);
    },

    async restoreBackup(id: string): Promise<boolean> {
      try {
        await api<{ restored: boolean }>("POST", `/backups/${id}/restore`);
        return true;
      } catch {
        return false;
      }
    },

    async listApprovalRequests(): Promise<ApprovalRequestVM[]> {
      try {
        const data = await api<{ approvalRequests: ApprovalRequestVM[] }>("GET", "/approval-requests");
        return data.approvalRequests || [];
      } catch {
        return [];
      }
    },

    async approveRequest(id: string): Promise<boolean> {
      try {
        await api("PUT", `/approval-requests/${id}`, { status: "allowed" });
        return true;
      } catch {
        return false;
      }
    },

    async denyRequest(id: string): Promise<boolean> {
      try {
        await api("PUT", `/approval-requests/${id}`, { status: "denied" });
        return true;
      } catch {
        return false;
      }
    },

    async listRiskNotices(): Promise<RiskNoticeVM[]> {
      try {
        const data = await api<{ riskNotices: RiskNoticeVM[] }>("GET", "/risk-notices");
        return data.riskNotices || [];
      } catch {
        return [];
      }
    },

    async listTrustGrants(): Promise<TrustGrantVM[]> {
      try {
        const data = await api<{ trustGrants: TrustGrantVM[] }>("GET", "/trust-grants");
        return data.trustGrants || [];
      } catch {
        return [];
      }
    },

    async revokeTrustGrant(id: string): Promise<boolean> {
      try {
        await api("POST", `/trust-grants/${id}/revoke`);
        return true;
      } catch {
        return false;
      }
    },

    async listPrompts(): Promise<PromptTemplateViewModel[]> {
      try {
        const data = await api<{ prompts: PromptDTO[] }>("GET", "/prompts");
        return (data.prompts || []).map((prompt) => ({
          id: prompt.id,
          name: prompt.name,
          nameZh: prompt.nameZh,
          content: prompt.content,
          category: prompt.category,
          tags: prompt.tags,
          isFavorite: !!prompt.isFavorite,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
        }));
      } catch {
        return [];
      }
    },

    async createPrompt(input: { name: string; nameZh?: string; content: string; category?: string; tags?: string[] }): Promise<PromptTemplateViewModel | null> {
      try {
        const { prompt } = await api<{ prompt: PromptDTO }>("POST", "/prompts", input);
        return {
          id: prompt.id,
          name: prompt.name,
          nameZh: prompt.nameZh,
          content: prompt.content,
          category: prompt.category,
          tags: prompt.tags,
          isFavorite: !!prompt.isFavorite,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
        };
      } catch {
        return null;
      }
    },

    async togglePromptFavorite(id: string, isFavorite?: boolean): Promise<PromptTemplateViewModel | null> {
      try {
        const { prompt } = await api<{ prompt: PromptDTO }>("PUT", `/prompts/${id}/favorite`, { isFavorite });
        return {
          id: prompt.id,
          name: prompt.name,
          nameZh: prompt.nameZh,
          content: prompt.content,
          category: prompt.category,
          tags: prompt.tags,
          isFavorite: !!prompt.isFavorite,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
        };
      } catch {
        return null;
      }
    },

    async deletePrompt(id: string): Promise<void> {
      await api<void>("DELETE", `/prompts/${id}`);
    },

    async getSkillsState(): Promise<SkillsAreaSnapshot | null> {
      try {
        const data = await api<SkillsStateDTO>("GET", "/skills");
        return data.skills;
      } catch {
        return null;
      }
    },

    async saveSkillsState(skills: SkillsAreaSnapshot): Promise<boolean> {
      try {
        await api("PUT", "/skills", { skills });
        return true;
      } catch {
        return false;
      }
    },

    async saveAppSettings(settings: AppSettingsSnapshot): Promise<boolean> {
      try {
        await api("PUT", "/settings", { settings });
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ─── UI Preferences (legitimate localStorage use) ───

const UI_PREFS_KEY = "agentsoul_ui_prefs";

export interface UiPrefs {
  activeTab?: string;
  dockPosition?: string;
  activeApp?: string;
  locale?: string;
}

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) return JSON.parse(raw) as UiPrefs;
  } catch { /* ignore */ }
  return {};
}

export function saveUiPrefs(prefs: UiPrefs): void {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
}

export function updateUiPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): UiPrefs {
  const prefs = loadUiPrefs();
  prefs[key] = value;
  saveUiPrefs(prefs);
  return prefs;
}
