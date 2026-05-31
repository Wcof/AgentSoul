/**
 * Costs Area — render functions
 * Renders the costs section with cost breakdown, token usage, provider/model mix,
 * key trend chart, and model stats chart.
 */
import type { CompanionRuntimeSnapshot, KeyTrendSnapshot, ModelStatsSnapshot, ChartDuration, KeyTrendView, ModelStatsView } from "../../types";
import { t, escapeHtml, formatMix, formatNumber } from "../../shared/utils";

export function renderCostsArea(snapshot: CompanionRuntimeSnapshot): string {
  const area = {
    ...snapshot.costs,
    areaKind: "Control Center Costs Area" as const,
    channels: snapshot.channels,
    dashboardStats: snapshot.dashboardStats,
    estimatedCostLabel: `${t("costs.estimatedCost", "Estimated Cost")}: $${snapshot.costs.estimatedCostUsd.toFixed(4)}`,
    providerUsageLabel: snapshot.costs.providerUsageUsd === undefined
      ? `${t("costs.providerUsage", "Provider Usage")}: ${t("common.notConnected", "not connected")}`
      : `${t("costs.providerUsage", "Provider Usage")}: $${snapshot.costs.providerUsageUsd.toFixed(4)}`,
    tokenUsageLabel: `${t("costs.tokenUsageTitle", "Token Usage")}: ${snapshot.costs.inputTokens + snapshot.costs.outputTokens} ${t("costs.total", "total")} (${snapshot.costs.inputTokens} ${t("costs.input", "input")} / ${snapshot.costs.outputTokens} ${t("costs.output", "output")})`,
    latencyLabel: `${t("costs.latencyTitle", "Latency")}: ${snapshot.costs.averageLatencyMs} ms ${t("costs.average", "average")}`,
  };
  const channels = area.channels ?? [];
  return `
    <section id="control-center-costs" class="control-center-area control-center-costs-area" data-control-area="costs" aria-label="Control Center Costs Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("costs.title", "Costs Area")}</p>
        <h2>${t("costs.breakdown", "Cost Breakdown")}</h2>
        <p>${escapeHtml(area.estimatedCostLabel)} . ${escapeHtml(area.providerUsageLabel)}</p>
      </div>
      <dl class="control-vitals">
        <div class="control-vital"><dt>${t("costs.tokenUsageTitle", "Token Usage")}</dt><dd>${escapeHtml(area.tokenUsageLabel)}</dd></div>
        <div class="control-vital"><dt>${t("costs.providerMix", "Provider Mix")}</dt><dd>${escapeHtml(formatMix(area.providerMix, "provider"))}</dd></div>
        <div class="control-vital"><dt>${t("costs.modelMix", "Model Mix")}</dt><dd>${escapeHtml(formatMix(area.modelMix, "model"))}</dd></div>
      </dl>
      ${channels.length > 0 ? `
        <div class="cost-breakdown" aria-label="Per-channel Cost Breakdown">
          <h3>${t("costs.perChannel", "Per-Channel Costs")}</h3>
          <div class="cost-table">
            <div class="cost-table-header"><span>${t("gateway.channel", "Channel")}</span><span>${t("costs.tokenUsageTitle", "Token")}</span><span>${t("costs.estimatedCost", "Estimated Cost")}</span></div>
            ${channels.map((ch) => `<div class="cost-table-row"><span class="cost-channel-name">${escapeHtml(ch.name)}</span><span>${((ch.totalInputTokens + ch.totalOutputTokens) / 1000).toFixed(1)}k</span><span class="cost-value">$${ch.estimatedCost.toFixed(4)}</span></div>`).join("")}
          </div>
        </div>
      ` : ""}
      <p class="control-note">${t("costs.note", "Estimated Cost is calculated locally from Audit Records.")}</p>
    </section>
  `;
}

export function renderKeyTrendChart(trend: KeyTrendSnapshot): string {
  const durationOptions: ChartDuration[] = ["1h", "6h", "24h", "today", "7d", "30d"];
  const viewOptions: Array<{ value: KeyTrendView; label: string; icon: string }> = [
    { value: "traffic", label: t("chart.traffic", "Traffic"), icon: "📈" },
    { value: "tokens", label: "Token I/O", icon: "📊" },
    { value: "cache", label: t("chart.cacheRw", "Cache R/W"), icon: "💾" },
  ];

  function renderSparkline(values: number[], view: string): string {
    if (values.length === 0) return '';
    const max = Math.max(...values, 1);
    const width = 300, height = 80;
    const step = width / (values.length - 1 || 1);
    const points = values.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;
    const colors: Record<string, string> = { traffic: "var(--accent-blue)", tokens: "var(--accent-purple)", cache: "var(--accent-cyan)" };
    const color = colors[view] || "var(--accent-blue)";
    return `<svg viewBox="0 0 ${width} ${height}" class="sparkline-svg"><polygon points="${areaPoints}" fill="${color}" opacity="0.1" /><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" /></svg>`;
  }

  return `
    <div class="key-trend-chart" data-chart-type="key-trend">
      <div class="chart-header">
        <div class="duration-selector">
          ${durationOptions.map((d) => `<button type="button" class="duration-btn ${trend.duration === d ? 'duration-btn--active' : ''}" data-duration="${d}">${d}</button>`).join("")}
          <button type="button" class="refresh-btn" data-chart-refresh title="${t('chart.refresh', 'Refresh')}">🔄</button>
        </div>
        <div class="view-selector">
          ${viewOptions.map((v) => `<button type="button" class="view-btn ${trend.view === v.value ? 'view-btn--active' : ''}" data-view="${v.value}"><span class="view-icon">${v.icon}</span> ${escapeHtml(v.label)}</button>`).join("")}
        </div>
      </div>
      <div class="summary-cards">
        <div class="summary-card"><span class="summary-label">${t('chart.totalRequests', 'Total Requests')}</span><span class="summary-value">${formatNumber(trend.summary.totalRequests)}</span></div>
        <div class="summary-card"><span class="summary-label">${t('chart.successRate', 'Success Rate')}</span><span class="summary-value ${trend.summary.avgSuccessRate >= 95 ? 'text-success' : trend.summary.avgSuccessRate >= 80 ? 'text-warning' : 'text-error'}">${trend.summary.avgSuccessRate.toFixed(1)}%</span></div>
        <div class="summary-card"><span class="summary-label">${t('chart.inputTokens', 'Input Tokens')}</span><span class="summary-value">${formatNumber(trend.summary.totalInputTokens)}</span></div>
        <div class="summary-card"><span class="summary-label">${t('chart.outputTokens', 'Output Tokens')}</span><span class="summary-value">${formatNumber(trend.summary.totalOutputTokens)}</span></div>
      </div>
      <div class="chart-area" data-chart-view="${trend.view}">
        ${trend.dataPoints.length === 0 ? `<div class="empty-state"><div class="empty-icon">📊</div><p>${t('chart.noData', 'No data in this time range')}</p></div>` : `<div class="sparkline-chart">${renderSparkline(trend.dataPoints.map((d) => d.requests), trend.view)}</div>`}
      </div>
    </div>
  `;
}

export function renderModelStatsChart(stats: ModelStatsSnapshot): string {
  const durationOptions: ChartDuration[] = ["1h", "6h", "24h", "today"];
  const viewOptions: Array<{ value: ModelStatsView; label: string; icon: string }> = [
    { value: "requests", label: t("chart.traffic", "Traffic"), icon: "📈" },
    { value: "tokens", label: "Token", icon: "📊" },
    { value: "cache", label: t("chart.cacheRw", "Cache R/W"), icon: "💾" },
  ];

  return `
    <div class="model-stats-chart" data-chart-type="model-stats">
      <div class="chart-header">
        <div class="duration-selector">
          ${durationOptions.map((d) => `<button type="button" class="duration-btn ${stats.duration === d ? 'duration-btn--active' : ''}" data-duration="${d}">${d}</button>`).join("")}
          <button type="button" class="refresh-btn" data-chart-refresh title="${t('chart.refresh', 'Refresh')}">🔄</button>
        </div>
        <div class="view-selector">
          ${viewOptions.map((v) => `<button type="button" class="view-btn ${stats.view === v.value ? 'view-btn--active' : ''}" data-view="${v.value}"><span class="view-icon">${v.icon}</span> ${escapeHtml(v.label)}</button>`).join("")}
        </div>
      </div>
      ${stats.topModels.length > 0 ? `<div class="compact-summary">${stats.topModels.map((m, i) => `<span class="model-tag"><span class="model-dot" style="background: var(--accent-${['blue', 'purple', 'cyan', 'green', 'orange'][i % 5]})"></span><strong>${escapeHtml(m.name)}</strong> ${formatNumber(m.count)} ${t('chart.requests', 'req')}</span>`).join("")}</div>` : ''}
      ${stats.models.length === 0 ? `<div class="empty-state"><div class="empty-icon">📊</div><p>${t('chart.noModelData', 'No model data in this time range')}</p></div>` : `
        <div class="model-stats-table">
          <table><thead><tr><th>${t('chart.model', 'Model')}</th><th>${t('chart.requests', 'Requests')}</th><th>${t('chart.inputTokens', 'Input')}</th><th>${t('chart.outputTokens', 'Output')}</th><th>${t('chart.successRate', 'Success')}</th><th>${t('chart.avgLatency', 'Latency')}</th></tr></thead>
          <tbody>${stats.models.map((m) => `<tr><td class="model-name">${escapeHtml(m.model)}</td><td>${formatNumber(m.requestCount)}</td><td>${formatNumber(m.inputTokens)}</td><td>${formatNumber(m.outputTokens)}</td><td class="${m.successRate >= 95 ? 'text-success' : m.successRate >= 80 ? 'text-warning' : 'text-error'}">${m.successRate.toFixed(1)}%</td><td>${m.avgLatencyMs}ms</td></tr>`).join("")}</tbody></table>
        </div>
      `}
    </div>
  `;
}
