/**
 * Shared component render functions used across multiple areas.
 */
import type { DashboardStatsSnapshot } from "../types";
import { t, escapeHtml } from "./utils";

export function renderDashboardStatsBar(stats: DashboardStatsSnapshot): string {
  return `
    <div class="dashboard-stats-bar" aria-label="Dashboard Stats">
      <div class="stat-chip"><span class="stat-value">${stats.totalChannels}</span><span class="stat-label">${t("gateway.channels.total", "Total Channels")}</span></div>
      <div class="stat-chip stat-chip--active"><span class="stat-value">${stats.activeChannels}</span><span class="stat-label">${t("gateway.channels.active", "Active Channels")}</span></div>
      <div class="stat-chip"><span class="stat-value">${stats.totalRequests.toLocaleString()}</span><span class="stat-label">${t("gateway.requests.total", "Total Requests")}</span></div>
      <div class="stat-chip"><span class="stat-value">$${stats.totalEstimatedCost.toFixed(4)}</span><span class="stat-label">${t("costs.estimatedCost", "Estimated Cost")}</span></div>
      <div class="stat-chip"><span class="stat-value">${stats.overallSuccessRate.toFixed(1)}%</span><span class="stat-label">${t("gateway.successRate", "Success Rate")}</span></div>
    </div>
  `;
}
