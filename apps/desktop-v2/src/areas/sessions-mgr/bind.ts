/**
 * Sessions-Mgr Area — bind functions
 */
import type { AreaContext } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function bindSessionsMgrArea(ctx: AreaContext): void {
  bindSessionMgrControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

function bindSessionMgrControls(
  target: HTMLElement,
  snapshot: import("../../types").CompanionRuntimeSnapshot,
  controller?: import("../../types").DesktopCompanionController,
  controlClient?: import("../../types").LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLInputElement>("[data-session-mgr-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const keyword = input.value.trim().toLowerCase();
      const sessions = snapshot.localSessions;
      const filtered = keyword
        ? sessions.filter((s) => s.projectDir.toLowerCase().includes(keyword) || (s.summary || "").toLowerCase().includes(keyword) || s.provider.toLowerCase().includes(keyword))
        : sessions;
      const listEl = target.querySelector(".session-list");
      if (listEl) {
        listEl.innerHTML = filtered.map((s) => `
          <article class="session-card" role="listitem" data-session-id="${escapeHtml(s.id)}">
            <div class="session-card-header">
              <span class="provider-badge">${escapeHtml(s.provider)}</span>
              <h4>${escapeHtml(s.projectDir)}</h4>
              <span class="session-time">${escapeHtml(s.lastActiveAt)}</span>
            </div>
            ${s.summary ? '<p class="session-summary">' + escapeHtml(s.summary) + '</p>' : ''}
            <div class="session-card-footer">
              <span class="session-msg-count">${s.messageCount} ${t("sessions.messages", "messages")}</span>
              ${s.isResumable ? '<button type="button" data-session-resume="' + escapeHtml(s.id) + '" class="channel-action-btn channel-action-btn--ghost">' + t("sessions.resume", "Resume") + '</button>' : '<span class="session-not-resumable">' + t("sessions.notResumable", "Not resumable") + '</span>'}
              <button type="button" data-session-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">&#128465;</button>
            </div>
          </article>
        `).join("");
      }
    });
  });
}
