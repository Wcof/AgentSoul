/**
 * Gateway Area — render functions
 * Renders the gateway section with channel orchestration, dashboard stats,
 * channel cards, logs dialog, capability test dialog, and global stats.
 */
import type {
  CompanionRuntimeSnapshot,
  ChannelListItemViewModel,
  DashboardStatsSnapshot,
  ChannelLogEntry,
  CapabilityTestJob,
  GlobalStatsSnapshot,
} from "../../types";
import { t, escapeHtml, formatNumber } from "../../shared/utils";
import { renderDashboardStatsBar } from "../../shared/components";

function successRateGrade(rate: number): number {
  if (rate >= 99) return 0;
  if (rate >= 95) return 1;
  if (rate >= 90) return 2;
  if (rate >= 80) return 3;
  if (rate >= 70) return 4;
  if (rate >= 50) return 5;
  return 6;
}

const WAVEFORM_GRADIENT_COLORS = [
  "rgb(34, 197, 94)", "rgb(132, 204, 22)", "rgb(250, 204, 21)",
  "rgb(251, 146, 60)", "rgb(249, 115, 22)", "rgb(239, 68, 68)", "rgb(220, 38, 38)",
];

export function renderActivityWaveform(requestCount: number, successRate: number, barCount = 30): string {
  const grade = successRateGrade(successRate);
  const color = WAVEFORM_GRADIENT_COLORS[grade];
  const seed = requestCount % 1000;
  let rects = "";
  for (let i = 0; i < barCount; i++) {
    const pseudoRandom = Math.abs(Math.sin(seed + i * 7.3) * 100) % 100;
    const heightPct = Math.max(5, Math.min(100, pseudoRandom * (requestCount > 0 ? 1 : 0.1)));
    const barWidth = 100 / barCount - 1;
    const x = (100 / barCount) * i;
    const height = heightPct * 0.4;
    rects += '<rect x="' + x.toFixed(1) + '" y="' + (100 - height).toFixed(1) + '" width="' + (barWidth * 0.8).toFixed(1) + '" height="' + height.toFixed(1) + '" fill="' + color + '" opacity="0.4" rx="1" ry="1"/>';
  }
  return '<svg class="activity-waveform" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">' + rects + '</svg>';
}

function circuitBadge(state: string): string {
  const colors: Record<string, string> = { closed: "var(--accent-green)", open: "var(--accent-red)", half_open: "var(--accent-orange)" };
  return '<span class="circuit-badge" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (colors[state] || "var(--text-muted)") + '"></span>';
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = { active: "var(--accent-green)", suspended: "var(--accent-orange)", disabled: "var(--text-muted)", healthy: "var(--accent-green)", error: "var(--accent-red)" };
  const c = colors[status] || "var(--text-muted)";
  return '<span class="status-badge" style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:700;background:' + c + '20;color:' + c + ';border:1px solid ' + c + '40">' + escapeHtml(status) + '</span>';
}

function renderChannelCard(ch: ChannelListItemViewModel, index: number): string {
  const waveform = renderActivityWaveform(ch.requestCount, ch.successRate);
  return `
    <article class="channel-card" role="listitem" data-channel-id="${escapeHtml(ch.id)}">
      ${waveform}
      <div class="channel-card-header">
        <div class="channel-card-title">
          <span class="channel-priority">#${index + 1}</span>
          <h4>${escapeHtml(ch.name)}</h4>
          ${statusBadge(ch.status)}
          ${circuitBadge(ch.circuitState)}
          <span class="channel-api-type">${escapeHtml(ch.apiType)}</span>
        </div>
        <div class="channel-card-actions">
          <button type="button" data-channel-edit="${escapeHtml(ch.id)}" title="${t("gateway.edit", "Edit")}">&#9997;</button>
          <button type="button" data-channel-ping="${escapeHtml(ch.id)}" title="${t("gateway.ping", "Ping")}">&#128225;</button>
          <button type="button" data-channel-delete="${escapeHtml(ch.id)}" title="${t("gateway.delete", "Delete")}">&#128465;</button>
          <button type="button" data-channel-menu="${escapeHtml(ch.id)}" class="channel-menu-btn" title="${t("common.more", "更多")}">&#8943;</button>
        </div>
      </div>
      <div class="channel-card-metrics">
        <div class="metric-item"><span class="metric-label">${t("gateway.requests", "Requests")}</span><span class="metric-value">${ch.requestCount.toLocaleString()}</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.successRate", "Success Rate")}</span><span class="metric-value ${ch.successRate < 95 ? "metric-value--warning" : ""}">${ch.successRate.toFixed(1)}%</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.latency", "Latency")}</span><span class="metric-value">${ch.averageLatencyMs.toFixed(0)}ms</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.tokens", "Tokens")}</span><span class="metric-value">${((ch.totalInputTokens + ch.totalOutputTokens) / 1000).toFixed(1)}k</span></div>
        <div class="metric-item"><span class="metric-label">${t("costs.estimatedCost", "Estimated Cost")}</span><span class="metric-value">$${ch.estimatedCost.toFixed(4)}</span></div>
      </div>
      ${ch.description ? '<p class="channel-card-desc">' + escapeHtml(ch.description) + '</p>' : ""}
      <p class="channel-card-url">${escapeHtml(ch.baseUrl)}</p>
      ${ch.consecutiveFailures > 0 ? '<p class="channel-card-failures">' + t("gateway.consecutiveFailures", "Consecutive Failures") + ': ' + ch.consecutiveFailures + '</p>' : ""}
    </article>
  `;
}

export function renderGatewayArea(snapshot: CompanionRuntimeSnapshot): string {
  const channels = snapshot.channels ?? [];
  const externalGateway = snapshot.gateway.externalToolGateway ?? {
    state: "stopped",
    host: "127.0.0.1",
    port: 3001,
    url: "http://127.0.0.1:3001",
    pid: null,
    message: t("gateway.externalToolGatewayStopped", "第三方工具网关未启动"),
  };
  const externalStateLabel = t(`gateway.externalToolGatewayState.${externalGateway.state}`, externalGateway.state);
  const area = {
    areaKind: "Control Center Gateway Area" as const,
    channels: snapshot.channels,
    dashboardStats: snapshot.dashboardStats,
    ...snapshot.gateway,
  };
  return `
    <section id="control-center-gateway" class="control-center-area control-center-gateway-area" data-control-area="gateway" aria-label="Control Center Gateway Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("gateway.title", "Gateway Area")}</p>
        <h2>${t("gateway.routingHealth", "Gateway Route Health")}</h2>
        <p>${t("gateway.activeProvider", "Active Provider Profile")}: ${escapeHtml(area.activeProviderName)}</p>
      </div>

      <dl class="control-vitals">
        <div class="control-vital"><dt>${t("gateway.routingHealth", "Gateway Route Health")}</dt><dd>${escapeHtml(t("gateway.state." + area.routeHealth, area.routeHealth))}</dd></div>
        <div class="control-vital"><dt>${t("gateway.adapterStatus", "Provider Adapter Support")}</dt><dd>${escapeHtml(t("gateway.state." + area.adapterSupport, area.adapterSupport))}</dd></div>
        <div class="control-vital"><dt>${t("gateway.clientProtocol", "Client Protocol")}</dt><dd>${escapeHtml(area.clientProtocol)}</dd></div>
        <div class="control-vital"><dt>${t("gateway.providerProtocol", "Provider Protocol")}</dt><dd>${escapeHtml(area.providerProtocol)}</dd></div>
        <div class="control-vital"><dt>${t("gateway.targetModel", "Target Model")}</dt><dd>${escapeHtml(area.targetModel)}</dd></div>
      </dl>
      <p class="control-note">${t("gateway.directFallback", "Direct Client Config fallback")}: ${escapeHtml(t("gateway.state." + area.fallbackStatus, area.fallbackStatus))}. ${t("gateway.note", "Gateway Route remains the default for audit, growth, and approval control.")}</p>

      <section class="external-tool-gateway-panel" aria-label="External Tool Gateway">
        <div class="channel-orchestration-header">
          <div>
            <h3>${t("gateway.externalToolGateway", "第三方工具网关")}</h3>
            <p class="control-note">${t("gateway.externalToolGatewayDesc", "给 Claude、Codex、Gemini 等第三方大模型工具使用；项目启动时不会自动开启。")}</p>
          </div>
          <span class="status-badge status-badge--${escapeHtml(externalGateway.state)}">${escapeHtml(externalStateLabel)}</span>
        </div>
        <dl class="control-vitals">
          <div class="control-vital"><dt>${t("gateway.externalToolGatewayUrl", "服务地址")}</dt><dd>${escapeHtml(externalGateway.url)}</dd></div>
          <div class="control-vital"><dt>${t("gateway.externalToolGatewayPort", "端口")}</dt><dd>${externalGateway.port}</dd></div>
          <div class="control-vital"><dt>PID</dt><dd>${externalGateway.pid ? String(externalGateway.pid) : "-"}</dd></div>
          <div class="control-vital"><dt>${t("gateway.externalToolGatewayMessage", "状态说明")}</dt><dd>${escapeHtml(externalGateway.message || "-")}</dd></div>
        </dl>
        <div class="channel-orchestration-actions">
          <button type="button" data-external-gateway-action="start" class="channel-action-btn" ${externalGateway.state === "running" ? "disabled" : ""}>${t("gateway.startExternalToolGateway", "启动服务")}</button>
          <button type="button" data-external-gateway-action="stop" class="channel-action-btn channel-action-btn--ghost" ${externalGateway.state !== "running" ? "disabled" : ""}>${t("gateway.stopExternalToolGateway", "暂停服务")}</button>
          <button type="button" data-external-gateway-action="restart" class="channel-action-btn channel-action-btn--ghost">${t("gateway.restartExternalToolGateway", "重启服务")}</button>
          <button type="button" data-external-gateway-action="refresh" class="channel-action-btn channel-action-btn--ghost">${t("common.refreshRuntime", "刷新状态")}</button>
        </div>
      </section>

      <div class="channel-orchestration" aria-label="Channel Orchestration">
        <div class="channel-orchestration-header">
          <h3>${t("gateway.failoverSequence", "Failover Sequence")}</h3>
          <div class="channel-orchestration-actions">
            <button type="button" data-channel-action="add" class="channel-action-btn">${t("gateway.addChannel", "Add Channel")}</button>
            <button type="button" data-channel-action="ping-all" class="channel-action-btn channel-action-btn--ghost">${t("gateway.pingAll", "Ping All")}</button>
          </div>
        </div>
        ${channels.length > 0 ? `
          <div class="channel-list" role="list" aria-label="Channel List">
            ${channels.map((ch, index) => renderChannelCard(ch, index)).join("")}
          </div>
        ` : `
          <div class="empty-state">
            <p>${t("gateway.noChannels", "No channels configured")}</p>
            <button type="button" data-channel-action="add" class="channel-action-btn">${t("gateway.addChannel", "Add Channel")}</button>
          </div>
        `}
      </div>
    </section>
  `;
}

export function renderChannelLogsDialog(channelName: string, logs: ChannelLogEntry[]): string {
  function logStatusColor(status: string): string {
    const colors: Record<string, string> = { completed: "var(--accent-green)", failed: "var(--accent-red)", streaming: "var(--accent-blue)", connecting: "var(--accent-orange)", pending: "var(--text-muted)" };
    return colors[status] || "var(--text-muted)";
  }

  return `
    <div class="channel-logs-dialog" aria-label="${t("channelLogs.title", "Channel Logs")} - ${escapeHtml(channelName)}">
      <div class="logs-header">
        <h3>${t("channelLogs.title", "Channel Logs")} - ${escapeHtml(channelName)}</h3>
        <label class="settings-toggle-label">
          <input type="checkbox" data-logs-auto-refresh checked />
          <span>${t("channelLogs.autoRefresh", "Auto Refresh")}</span>
        </label>
      </div>
      <div class="logs-scroll">
        ${logs.length === 0 ? '<div class="empty-state"><p>' + t("channelLogs.empty", "No logs") + '</p></div>' : ''}
        ${logs.map((log, i) => `
          <div class="log-item${log.status === 'failed' ? ' log-item--error' : ''}" data-log-index="${i}">
            <div class="log-row">
              <span class="log-status-code" style="color: ${logStatusColor(log.status)}">${log.statusCode || '-'}</span>
              <span class="log-time">${escapeHtml(log.timestamp)}</span>
              <span class="log-status-badge" style="color: ${logStatusColor(log.status)}">${escapeHtml(log.status)}</span>
              ${log.interfaceType ? '<span class="log-interface">' + escapeHtml(log.interfaceType) + '</span>' : ''}
              <span class="log-model">${escapeHtml(log.model)}</span>
              <code class="log-key">${escapeHtml(log.keyMask)}</code>
              ${log.connectMs !== undefined ? '<span class="log-duration">' + t("channelLogs.duration.connect", "Connect") + ' ' + log.connectMs + 'ms</span>' : ''}
              ${log.firstByteMs !== undefined ? '<span class="log-duration">' + t("channelLogs.duration.firstByte", "First Byte") + ' ' + log.firstByteMs + 'ms</span>' : ''}
              <span class="log-duration">${t("channelLogs.duration.total", "Total")} ${log.durationMs}ms</span>
              ${log.isRetry ? '<span class="log-retry">' + t("channelLogs.retry", "Retry") + '</span>' : ''}
            </div>
            ${log.errorInfo ? '<div class="log-error-detail">' + escapeHtml(log.errorInfo) + '</div>' : ''}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderCapabilityTestDialog(job: CapabilityTestJob): string {
  const progressPct = job.totalModels > 0 ? (job.completedModels / job.totalModels * 100) : 0;
  return `
    <div class="capability-dialog" aria-label="${t("capability.title", "Capability Test")}">
      <div class="capability-header">
        <h3>${t("capability.title", "Capability Test")} - ${escapeHtml(job.channelName)}</h3>
        <span class="capability-status capability-status--${job.status}">${escapeHtml(job.status)}</span>
      </div>
      ${job.status === "running" ? `
        <div class="capability-progress">
          <div class="progress-bar"><div class="progress-fill" style="width: ${progressPct}%"></div></div>
          <span class="progress-text">${job.completedModels}/${job.totalModels} ${t("capability.progressSummary", "models completed")}</span>
        </div>
      ` : ''}
      <div class="capability-results">
        <div class="capability-table-header">
          <span>${t("capability.table.protocol", "Protocol")}</span>
          <span>${t("capability.table.status", "Status")}</span>
          <span>${t("capability.table.latency", "Latency")}</span>
          <span>${t("capability.table.streaming", "Streaming")}</span>
        </div>
        ${job.results.map((r) => `
          <div class="capability-table-row${r.success ? '' : ' capability-table-row--failed'}">
            <span>${escapeHtml(r.protocol)}</span>
            <span class="capability-result-status">${r.success ? t("capability.success", "Success") : t("capability.failed", "Failed")}</span>
            <span>${r.latencyMs}ms</span>
            <span>${r.streamingSupported ? t("capability.supported", "Supported") : t("capability.unsupported", "Unsupported")}</span>
          </div>
        `).join("")}
      </div>
      ${job.finishedAt ? '<p class="capability-meta">' + t("capability.testedAt", "Tested At") + ': ' + escapeHtml(job.finishedAt) + '</p>' : ''}
    </div>
  `;
}

export function renderGlobalStatsChart(stats: GlobalStatsSnapshot): string {
  const maxTraffic = Math.max(...stats.trafficHistory.map(d => d.value), 1);
  const maxTokens = Math.max(...stats.tokenHistory.map(d => d.value), 1);
  const maxCost = Math.max(...stats.costHistory.map(d => d.value), 0.01);

  function sparkline(data: Array<{value: number}>, max: number, color: string): string {
    if (data.length < 2) return "";
    const w = 200, h = 40;
    const step = w / (data.length - 1);
    const points = data.map((d, i) => (i * step) + "," + (h - (d.value / max * h))).join(" ");
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="stats-sparkline"><polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + points + '"/></svg>';
  }

  return `
    <section class="global-stats" aria-label="Global Statistics">
      <div class="stats-grid">
        <div class="stats-card"><h4>${t("chart.traffic", "Traffic")}</h4>${sparkline(stats.trafficHistory, maxTraffic, "var(--accent-blue)")}<span class="stats-total">${stats.trafficHistory.reduce((s, d) => s + d.value, 0).toLocaleString()} ${t("chart.requestUnit", "requests")}</span></div>
        <div class="stats-card"><h4>${t("chart.tokens", "Tokens")}</h4>${sparkline(stats.tokenHistory, maxTokens, "var(--accent-cyan)")}<span class="stats-total">${(stats.tokenHistory.reduce((s, d) => s + d.value, 0) / 1000).toFixed(1)}k</span></div>
        <div class="stats-card"><h4>${t("costs.estimatedCost", "Cost")}</h4>${sparkline(stats.costHistory, maxCost, "var(--accent-green)")}<span class="stats-total">$${stats.costHistory.reduce((s, d) => s + d.value, 0).toFixed(2)}</span></div>
        <div class="stats-card"><h4>${t("chart.successRate", "Success Rate")}</h4>${sparkline(stats.successRateHistory, 100, "var(--accent-purple)")}<span class="stats-total">${stats.successRateHistory.length > 0 ? stats.successRateHistory[stats.successRateHistory.length - 1].value.toFixed(1) + '%' : '--'}</span></div>
      </div>
    </section>
  `;
}
