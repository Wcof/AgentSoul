/**
 * Costs Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type {
  CostsAreaSnapshot,
  ChannelListItemViewModel,
  DashboardStatsSnapshot,
  KeyTrendSnapshot,
  ModelStatsSnapshot,
} from "../../types";

// ─── Per-Channel Cost Row ───

export interface ChannelCostRowViewModel {
  name: string;
  requestCount: number;
  successRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

// ─── Costs ViewModel ───

export interface CostsViewModel extends CostsAreaSnapshot {
  readonly areaKind: "Control Center Costs Area";
  estimatedCostLabel: string;
  providerUsageLabel: string;
  tokenUsageLabel: string;
  latencyLabel: string;
  channels: ChannelListItemViewModel[];
  dashboardStats: DashboardStatsSnapshot;
}

// ─── Key Trend Chart ViewModel ───

export type { KeyTrendSnapshot };

// ─── Model Stats Chart ViewModel ───

export type { ModelStatsSnapshot };
