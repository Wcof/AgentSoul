/**
 * Shared App Switcher — renderAppSwitcher and bindAppSwitcherControls
 */
import type { AppSwitcherSnapshot, AppId } from "../types";
import { t, escapeHtml } from "./utils";
import { showToast } from "../utils/modal";

export function renderAppSwitcher(switcher: AppSwitcherSnapshot): string {
  const apps = Object.entries(switcher.visibleApps)
    .filter(([_, visible]) => visible)
    .map(([id]) => id as AppId);

  const appIcons: Record<AppId, string> = {
    claude: "🤖", "claude-desktop": "🖥️", codex: "🔮", gemini: "✨",
    opencode: "📝", openclaw: "🐾", hermes: "⚡", agentsoul: "💜",
  };
  const appNameKey: Record<AppId, string> = {
    claude: "apps.claude", "claude-desktop": "apps.claudeDesktop", codex: "apps.codex",
    gemini: "apps.gemini", opencode: "apps.opencode", openclaw: "apps.openclaw",
    hermes: "apps.hermes", agentsoul: "apps.agentsoul",
  };

  return `
    <div class="app-switcher" data-app-switcher>
      <div class="app-switcher-tabs">
        ${apps.map((app) => `
          <button type="button" class="app-tab ${switcher.activeApp === app ? 'app-tab--active' : ''}"
            data-app-id="${app}" title="${escapeHtml(t(appNameKey[app], switcher.appNames[app]))}">
            <span class="app-icon">${appIcons[app]}</span>
            <span class="app-name">${escapeHtml(t(appNameKey[app], switcher.appNames[app]))}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

export function bindAppSwitcherControls(
  target: HTMLElement,
  snapshot: import("../types").CompanionRuntimeSnapshot,
  controller?: import("../types").DesktopCompanionController,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-app-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appId = btn.dataset.appId as AppId;
      snapshot.appSwitcher.activeApp = appId;
      if (typeof localStorage !== "undefined") localStorage.setItem("agentsoul_active_app", appId);
      controller?.render(snapshot);
      showToast(t("appSwitcher.switched", "Switched to") + ": " + appId, "success");
    });
  });
}

export function renderUpdateDialog(update: import("../types").UpdateInfo): string {
  return `
    <dialog class="update-dialog" data-dialog="update">
      <div class="update-dialog-content">
        <div class="update-header">
          <h3>${t('update.title', 'Update Available')}</h3>
          <button type="button" class="close-btn" data-dialog-close>X</button>
        </div>
        <div class="update-body">
          <div class="version-info">
            <span class="current-version">${t('update.current', 'Current')}: ${escapeHtml(update.currentVersion)}</span>
            <span class="version-arrow">→</span>
            <span class="latest-version">${t('update.latest', 'Latest')}: ${escapeHtml(update.latestVersion)}</span>
          </div>
          ${update.releaseNotes ? `<div class="release-notes"><h4>${t('update.releaseNotes', 'Release Notes')}</h4><div class="notes-content">${escapeHtml(update.releaseNotes)}</div></div>` : ''}
          <div class="update-meta">
            <span>${t('update.publishedAt', 'Published')}: ${escapeHtml(update.publishedAt)}</span>
            ${update.isMandatory ? `<span class="mandatory-badge">${t('update.mandatory', 'Mandatory')}</span>` : ''}
          </div>
        </div>
        <div class="update-actions">
          <button type="button" class="btn btn--secondary" data-dialog-close>${t('update.later', 'Later')}</button>
          ${update.downloadUrl ? `<a href="${escapeHtml(update.downloadUrl)}" target="_blank" class="btn btn--primary">${t('update.download', 'Download')}</a>` : `<button type="button" class="btn btn--primary" data-dialog-close>${t('update.ok', 'OK')}</button>`}
        </div>
      </div>
    </dialog>
  `;
}

export function bindUpdateDialogControls(target: HTMLElement): void {
  target.querySelectorAll<HTMLButtonElement>("[data-dialog-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      if (dialog) (dialog as HTMLDialogElement).close();
    });
  });
}
