/**
 * Sessions-Mgr Area — render functions
 * Renders the session manager area with search and session cards.
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

function sessionProviderBadge(provider: string): string {
  const labels: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", "gemini-cli": "Gemini CLI", agentsoul: "AgentSoul" };
  return '<span class="provider-badge">' + escapeHtml(labels[provider] || provider) + '</span>';
}

export function renderSessionsMgrArea(snapshot: CompanionRuntimeSnapshot): string {
  const sessions = snapshot.localSessions || [];
  return `
    <section id="control-center-sessions-mgr" class="control-center-area" data-control-area="sessions-mgr" aria-label="Session Manager">
      <div class="control-area-header">
        <p class="eyebrow">${t("sessions.mgrTitle", "Session Manager")}</p>
        <h2>${t("sessions.mgrSubtitle", "Browse & Resume Local Sessions")}</h2>
      </div>
      <label class="session-search">
        <span>${t("sessions.keyword", "Keyword")}</span>
        <input type="search" data-session-mgr-search placeholder="${t("sessions.searchPlaceholder", "Search sessions...")}" />
      </label>
      <div class="session-list" role="list">
        ${sessions.length === 0 ? `<div class="empty-state"><p>${t("sessions.noSessions", "No sessions found")}</p></div>` : ''}
        ${sessions.map((s) => `
          <article class="session-card" role="listitem" data-session-id="${escapeHtml(s.id)}">
            <div class="session-card-header">
              ${sessionProviderBadge(s.provider)}
              <h4>${escapeHtml(s.projectDir)}</h4>
              <span class="session-time">${escapeHtml(s.lastActiveAt)}</span>
            </div>
            ${s.summary ? '<p class="session-summary">' + escapeHtml(s.summary) + '</p>' : ''}
            <div class="session-card-footer">
              <span class="session-msg-count">${s.messageCount} ${t("sessions.messages", "messages")}</span>
              ${s.isResumable ? '<button type="button" data-session-launch="' + escapeHtml(s.id) + '" class="channel-action-btn channel-action-btn--ghost">' + t("sessions.resume", "Resume") + '</button>' : '<span class="session-not-resumable">' + t("sessions.notResumable", "Not resumable") + '</span>'}
              <button type="button" data-session-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">&#128465;</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
