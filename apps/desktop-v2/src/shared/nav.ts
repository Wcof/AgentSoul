/**
 * Shared Navigation — renderControlCenterTaskNavigation and bindControlCenterNavigation
 */
import { t } from "./utils";

export function renderControlCenterTaskNavigation(): string {
  return `
    <nav class="control-center-nav" aria-label="Control Center task navigation">
      <p class="eyebrow">${t("nav.title", "Control Center task navigation")}</p>
      <p class="control-note">${t("nav.note", "Local-first configuration surface; cloud login not required.")}</p>
      <div class="control-center-nav-actions">
        <a href="#control-center-companion" data-nav-target="companion">${t("nav.companion", "Companion")}</a>
        <a href="#control-center-gateway" data-nav-target="gateway">${t("nav.gateway", "Gateway")}</a>
        <a href="#control-center-skills" data-nav-target="skills">${t("nav.skills", "Skills")}</a>
        <a href="#control-center-sessions" data-nav-target="sessions">${t("nav.sessions", "Sessions")}</a>
        <a href="#control-center-conversations" data-nav-target="conversations">${t("nav.conversations", "Conversations")}</a>
        <a href="#control-center-costs" data-nav-target="costs">${t("nav.costs", "Costs")}</a>
        <a href="#control-center-safety" data-nav-target="safety">${t("nav.safety", "Safety")}</a>
        <a href="#control-center-settings" data-nav-target="settings">${t("nav.settings", "Settings")}</a>
        <a href="#control-center-settings-full" data-nav-target="settings-full">${t("nav.settingsFull", "Full Settings")}</a>
        <a href="#control-center-sessions-mgr" data-nav-target="sessions-mgr">${t("nav.sessionsMgr", "Sessions")}</a>
        <a href="#control-center-mcp" data-nav-target="mcp">${t("nav.mcp", "MCP")}</a>
        <a href="#control-center-prompts" data-nav-target="prompts">${t("nav.prompts", "Prompts")}</a>
      </div>
    </nav>
  `;
}

export function bindControlCenterNavigation(target: HTMLElement): void {
  target.querySelectorAll<HTMLAnchorElement>("[data-nav-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const area = link.dataset.navTarget;
      if (!area) return;
      const shell = target.querySelector<HTMLElement>(".shell");
      if (shell) shell.setAttribute("data-active-tab", area);
      if (typeof localStorage !== "undefined") {
        try { localStorage.setItem("agentsoul_active_tab", area); } catch {}
      }
    });
  });
}
