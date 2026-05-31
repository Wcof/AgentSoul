/**
 * Sessions Area — render functions
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderSessionsArea(snapshot: CompanionRuntimeSnapshot): string {
  const area = {
    areaKind: "Control Center Sessions Area" as const,
    searchLabel: "Work Session search" as const,
    launcherLabel: "safety-gated Session Launcher" as const,
    launchSafetyAction: "launch-session" as const,
    ...snapshot.sessions,
  };
  return `
    <section id="control-center-sessions" class="control-center-area control-center-sessions-area" data-control-area="sessions" aria-label="Control Center Sessions Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("sessions.title", "Sessions Area")}</p>
        <h2>${t("sessions.searchLabel", area.searchLabel)}</h2>
        <p>${t("sessions.searchDesc", "Search Index from Session Source metadata and evidence.")} ${t("sessions.launcherLabel", area.launcherLabel)} ${t("sessions.safetyPolicyNote", "uses Safety Policy before terminal execution.")}</p>
      </div>
      <label class="session-search">
        <span>${t("sessions.keyword", "Keyword")}</span>
        <input type="search" data-session-search="keyword" value="${escapeHtml(area.query.keyword)}" aria-label="Work Session search keyword" />
      </label>
      <div class="session-results" aria-label="Work Sessions">
        ${area.workSessions.map((session) => {
          const resume = session.resumable && session.resumeCommand
            ? `<button type="button" data-session-launch="${escapeHtml(session.id)}" data-safety-action="${area.launchSafetyAction}">${t("sessions.resume", "Resume Session")}</button>`
            : "";
          return `
            <article class="session-row">
              <h3>${escapeHtml(session.projectPath)}</h3>
              <p>${t("sessions.source", "Session Source")}: ${escapeHtml(session.source)} · ${escapeHtml(session.client)} · ${escapeHtml(session.lastActiveAt)}</p>
              <p>${escapeHtml(session.evidenceSummary)}</p>
              <p>${t("sessions.searchable", "Searchable")}: ${session.searchable ? t("common.yes", "yes") : t("common.no", "no")} · ${t("sessions.resumable", "Resumable")}: ${session.resumable ? t("common.yes", "yes") : t("common.no", "no")}</p>
              ${session.resumeCommand ? `<p>${t("sessions.resumeCommand", "Session Resume Command")}: ${escapeHtml(session.resumeCommand)}</p>` : ""}
              ${resume}
            </article>
          `;
        }).join("")}
      </div>
      <p class="control-note">${t("sessions.launcherNote", "Session Launcher actions use")} ${escapeHtml(area.launchSafetyAction)} ${t("sessions.launcherNoteSuffix", "and are available only for resumable Work Sessions.")}</p>
    </section>
  `;
}
