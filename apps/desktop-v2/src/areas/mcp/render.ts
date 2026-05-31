/**
 * MCP Area — render functions
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderMcpArea(snapshot: CompanionRuntimeSnapshot): string {
  const mcpServers = snapshot.mcpServers || [];
  return `
    <section id="control-center-mcp" class="control-center-area" data-control-area="mcp" aria-label="MCP Server Management">
      <div class="control-area-header">
        <p class="eyebrow">${t("mcp.title", "MCP Servers")}</p>
        <h2>${t("mcp.subtitle", "Model Context Protocol Servers")}</h2>
        <div class="channel-orchestration-actions"><button type="button" data-mcp-add class="channel-action-btn">${t("mcp.addServer", "Add MCP Server")}</button></div>
      </div>
      <div class="mcp-list" role="list">
        ${mcpServers.length === 0 ? `<div class="empty-state"><p>${t("mcp.noServers", "No MCP servers configured")}</p></div>` : ''}
        ${mcpServers.map((s) => `
          <article class="mcp-card" role="listitem" data-mcp-id="${escapeHtml(s.id)}">
            <div class="mcp-card-header">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="mcp-status mcp-status--${s.status}">${escapeHtml(s.status)}</span>
              ${s.toolCount !== undefined ? '<span class="mcp-tools">' + s.toolCount + ' ' + t("mcp.tools", "tools") + '</span>' : ''}
            </div>
            <p class="mcp-command"><code>${escapeHtml(s.command)} ${(s.args || []).map(escapeHtml).join(" ")}</code></p>
            ${s.errorMessage ? '<p class="mcp-error">' + escapeHtml(s.errorMessage) + '</p>' : ''}
            <div class="mcp-card-actions">
              <button type="button" data-mcp-toggle="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost">${s.status === "running" ? t("mcp.stop", "Stop") : t("mcp.start", "Start")}</button>
              <button type="button" data-mcp-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">${t("mcp.delete", "Delete")}</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
