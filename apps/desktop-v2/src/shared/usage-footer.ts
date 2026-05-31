/**
 * Shared Usage Footer — render and bind
 */
import type { UsageFooterSnapshot, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike } from "../types";
import { t, escapeHtml, formatNumber } from "./utils";
import { showToast } from "../utils/modal";

export function renderUsageFooter(usage: UsageFooterSnapshot): string {
  if (!usage.usageEnabled || !usage.usage) return '';
  const data = usage.usage;
  const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return `
    <div class="usage-footer ${isCritical ? 'usage-footer--critical' : isWarning ? 'usage-footer--warning' : ''}" data-provider-id="${escapeHtml(usage.providerId)}">
      <div class="usage-header">
        <span class="provider-name">${escapeHtml(usage.providerName)}</span>
        ${usage.isCurrent ? `<span class="current-badge">${t('usage.current', 'Current')}</span>` : ''}
      </div>
      ${!data.success ? `<div class="usage-error"><span class="error-icon">⚠️</span><span>${escapeHtml(data.errorMessage || t('usage.fetchFailed', 'Failed to fetch usage'))}</span></div>` : `
        <div class="usage-bar-container"><div class="usage-bar" style="width: ${Math.min(percentage, 100)}%"></div></div>
        <div class="usage-details"><span class="usage-used">${formatNumber(data.used)} / ${formatNumber(data.total)} ${escapeHtml(data.unit)}</span><span class="usage-percentage">${percentage.toFixed(1)}%</span></div>
        ${data.planName ? `<div class="usage-plan">${escapeHtml(data.planName)}</div>` : ''}
        ${data.resetsAt ? `<div class="usage-resets">${t('usage.resets', 'Resets')}: ${escapeHtml(data.resetsAt)}</div>` : ''}
      `}
      ${usage.lastQueriedAt ? `<div class="usage-last-queried"><span>${t('usage.lastQueried', 'Last queried')}: ${escapeHtml(usage.lastQueriedAt)}</span><button type="button" class="refresh-btn" data-usage-refresh title="${t('usage.refresh', 'Refresh')}">🔄</button></div>` : ''}
    </div>
  `;
}

export function bindUsageFooterControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-usage-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showToast(t("usage.refreshing", "Refreshing usage data..."), "info");
      if (!controlClient) return;
      try {
        const fresh = await controlClient.loadSnapshot();
        snapshot.usageFooter = fresh.usageFooter;
        snapshot.dashboardStats = fresh.dashboardStats;
        snapshot.channels = fresh.channels;
        snapshot.keyTrend = { ...snapshot.keyTrend, ...fresh.keyTrend, duration: snapshot.keyTrend.duration, view: snapshot.keyTrend.view };
        snapshot.modelStats = { ...snapshot.modelStats, ...fresh.modelStats, duration: snapshot.modelStats.duration, view: snapshot.modelStats.view };
        controller?.render(snapshot);
        showToast(t("usage.refreshed", "用量已刷新"), "success");
      } catch { showToast(t("usage.refreshFailed", "用量刷新失败"), "error"); }
    });
  });
}
