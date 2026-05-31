/**
 * Settings Area — render functions
 * Renders the settings section with persona templates, locale switcher,
 * and basic settings vitals.
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderSettingsArea(snapshot: CompanionRuntimeSnapshot): string {
  const area = {
    areaKind: "Control Center Settings Area" as const,
    personaTemplates: snapshot.personaTemplates ?? [],
    customization: snapshot.companionCustomization,
    ...snapshot.settings,
  };
  const cust = area.customization;
  const templates = area.personaTemplates;
  return `
    <section id="control-center-settings" class="control-center-area control-center-settings-area" data-control-area="settings" aria-label="Control Center Settings Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("settings.title", "Settings Area")}</p>
        <h2>${t("settings.localFirst", "Local-first")}</h2>
        <p>${t("settings.cloudLoginNotRequired", "Cloud login not required.")}</p>
      </div>

      <div class="settings-section" aria-label="Persona Templates">
        <h3>${t("settings.persona", "Persona Configuration")}</h3>
        <div class="persona-grid">
          ${templates.map((tpl) => `
            <article class="persona-card" data-persona-select="${escapeHtml(tpl.id)}">
              <h4>${escapeHtml(tpl.nameZh)} / ${escapeHtml(tpl.name)}</h4>
              <p class="persona-role">${escapeHtml(tpl.role)}</p>
              <p class="persona-desc">${escapeHtml(tpl.descriptionZh)}</p>
              <div class="persona-traits">${tpl.personality.map((p) => '<span class="trait-tag">' + escapeHtml(p) + '</span>').join("")}</div>
            </article>
          `).join("")}
        </div>
      </div>

      <div class="settings-section" aria-label="Locale">
        <h3>${t("settings.locale", "Language")}</h3>
        <div class="locale-switcher-inline">
          <button type="button" data-locale="zh" class="locale-btn locale-btn--active">中文</button>
          <button type="button" data-locale="en" class="locale-btn">English</button>
        </div>
      </div>

      <dl class="control-vitals">
        <div class="control-vital"><dt>${t("settings.localFirst", "Local-first")}</dt><dd>${escapeHtml(t("common." + area.localFirstStatus, area.localFirstStatus))}</dd></div>
        <div class="control-vital"><dt>${t("settings.cloudLogin", "Cloud login")}</dt><dd>${area.cloudLoginRequired ? t("settings.required", "required") : t("settings.notRequired", "not required")}</dd></div>
        <div class="control-vital"><dt>${t("settings.sensitiveExport", "Sensitive Export")}</dt><dd>${escapeHtml(t("settings.safetyAction." + area.sensitiveExportSafetyAction, area.sensitiveExportSafetyAction))}</dd></div>
        <div class="control-vital"><dt>${t("settings.remoteSync", "Remote Sync")}</dt><dd>${escapeHtml(t("settings.remoteSyncStatus." + area.remoteSyncStatus, area.remoteSyncStatus))}</dd></div>
        <div class="control-vital"><dt>${t("settings.growthProfile", "Growth Profile")}</dt><dd>${escapeHtml(area.growthProfile.name)}</dd></div>
        <div class="control-vital"><dt>${t("settings.xpMultiplier", "XP multiplier")}</dt><dd>${area.growthProfile.xpMultiplier}</dd></div>
        <div class="control-vital"><dt>${t("settings.energyCost", "Energy cost")}</dt><dd>${area.growthProfile.energyCostMultiplier}</dd></div>
        <div class="control-vital"><dt>${t("settings.fatigueThreshold", "Fatigue threshold")}</dt><dd>${area.growthProfile.fatigueThreshold}%</dd></div>
        <div class="control-vital"><dt>${t("settings.growthCap", "Growth Cap")}</dt><dd>XP ${area.growthProfile.maxXpPerEvent} . Energy ${area.growthProfile.maxEnergyCostPerEvent}</dd></div>
      </dl>
      <p class="control-note">${t("settings.note", "User-managed Export keeps backups under the user's control. Sensitive Export requires explicit high-risk confirmation.")}</p>
    </section>
  `;
}

export function renderDeepLinkImportDialog(importState: import("../../types").DeepLinkImportSnapshot): string {
  const typeIcons: Record<string, string> = { channel: "📡", provider: "🔌", config: "⚙️", skill: "🎯" };
  return `
    <dialog class="deeplink-dialog" data-dialog="deeplink-import">
      <div class="deeplink-dialog-content">
        <div class="deeplink-header">
          <h3>${t('deeplink.title', 'Import Configuration')}</h3>
          <button type="button" class="close-btn" data-dialog-close>✕</button>
        </div>
        <div class="deeplink-body">
          <div class="deeplink-input-area">
            <textarea data-deeplink-input placeholder="${t('deeplink.placeholder', 'Paste configuration URLs (one per line)...')}" rows="4"></textarea>
            <button type="button" class="btn btn--primary" data-deeplink-parse>${t('deeplink.parse', 'Parse')}</button>
          </div>
          ${importState.links.length > 0 ? `<div class="deeplink-list">${importState.links.map((link) => `<div class="deeplink-item" data-deeplink-url="${escapeHtml(link.url)}"><span class="deeplink-icon">${typeIcons[link.type] || "🔗"}</span><div class="deeplink-info"><span class="deeplink-type">${escapeHtml(link.type)}</span>${link.name ? `<span class="deeplink-name">${escapeHtml(link.name)}</span>` : ''}${link.description ? `<span class="deeplink-desc">${escapeHtml(link.description)}</span>` : ''}</div><span class="deeplink-url">${escapeHtml(link.url)}</span></div>`).join("")}</div>` : ''}
          ${importState.isImporting ? `<div class="import-progress"><div class="progress-bar"><div class="progress-fill" style="width: ${importState.importProgress}%"></div></div><span>${importState.importProgress}%</span></div>` : ''}
          ${importState.lastImportResult ? `<div class="import-result ${importState.lastImportResult.success ? 'import-result--success' : 'import-result--error'}"><span>${importState.lastImportResult.success ? '✅' : '❌'}</span><span>${escapeHtml(importState.lastImportResult.message)}</span>${importState.lastImportResult.importedCount > 0 ? `<span>${t('deeplink.imported', 'Imported')}: ${importState.lastImportResult.importedCount}</span>` : ''}</div>` : ''}
        </div>
        <div class="deeplink-actions">
          <button type="button" class="btn btn--secondary" data-dialog-close>${t('common.cancel', 'Cancel')}</button>
          <button type="button" class="btn btn--primary" data-deeplink-run ${importState.links.length === 0 || importState.isImporting ? 'disabled' : ''}>${importState.isImporting ? t('deeplink.importing', 'Importing...') : t('deeplink.import', 'Import All')}</button>
        </div>
      </div>
    </dialog>
  `;
}
