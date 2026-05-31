/**
 * Gateway Area — ViewModel types
 * Derived from @agentsoul/domain types for type-safe UI rendering.
 */

// ─── Channel List Item ViewModel ───

export interface ChannelListItemViewModel {
  id: string;
  name: string;
  status: string;
  circuitState: string;
  requestCount: number;
  successRate: number;
  avgLatencyMs: number;
  providerProtocol: string;
  targetModel: string;
}

// ─── Dashboard Stats ───

export interface DashboardStatsSnapshot {
  totalChannels: number;
  activeChannels: number;
  totalRequests: number;
  totalEstimatedCost: number;
  overallSuccessRate: number;
}

// ─── Channel Log Entry ───

export interface ChannelLogEntry {
  timestamp: string;
  statusCode: number;
  status: string;
  model: string;
  durationMs: number;
  tokens?: { input: number; output: number };
  errorInfo?: string;
}

// ─── Capability Test Job ───

export interface CapabilityTestJob {
  id: string;
  channelName: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  result?: string;
}

// ─── Global Stats ───

export interface GlobalStatsSnapshot {
  totalTokensUsed: number;
  totalCost: number;
  avgResponseTime: number;
  uptime: string;
}

// ─── Gateway ViewModel ───

export interface GatewayViewModel {
  readonly viewModelKind: "Control Center Gateway Area";
  channels: ChannelListItemViewModel[];
  dashboardStats: DashboardStatsSnapshot;
  activeProviderLabel: string;
}
