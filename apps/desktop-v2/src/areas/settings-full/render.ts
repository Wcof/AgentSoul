/**
 * Settings-Full Area — render functions
 * Renders the full application settings with tabbed interface.
 */
import type { AppSettingsSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderSettingsFullArea(snapshot: import("../../types").CompanionRuntimeSnapshot): string {
  return renderFullSettingsArea(snapshot.appSettings);
}

export function renderFullSettingsArea(settings: AppSettingsSnapshot): string {
  return `
    <section id="control-center-settings-full" class="control-center-area" data-control-area="settings-full" aria-label="Full Settings">
      <div class="control-area-header">
        <p class="eyebrow">${t("settings.fullTitle", "Settings")}</p>
        <h2>${t("settings.fullSubtitle", "Application Configuration")}</h2>
      </div>
      <div class="settings-tabs" role="tablist">
        <button type="button" class="settings-tab settings-tab--active" data-settings-tab="general">${t("settings.tabGeneral", "General")}</button>
        <button type="button" class="settings-tab" data-settings-tab="appearance">${t("settings.tabAppearance", "Appearance")}</button>
        <button type="button" class="settings-tab" data-settings-tab="terminal">${t("settings.tabTerminal", "Terminal")}</button>
        <button type="button" class="settings-tab" data-settings-tab="proxy">${t("settings.tabProxy", "Proxy")}</button>
        <button type="button" class="settings-tab" data-settings-tab="failover">${t("settings.tabFailover", "Failover")}</button>
        <button type="button" class="settings-tab" data-settings-tab="privacy">${t("settings.tabPrivacy", "Privacy")}</button>
        <button type="button" class="settings-tab" data-settings-tab="backup">${t("settings.tabBackup", "Backup")}</button>
        <button type="button" class="settings-tab" data-settings-tab="webdav">${t("settings.tabWebdav", "WebDAV")}</button>
      </div>
      <div class="settings-content">
        <div class="settings-panel" data-settings-panel="general">
          <h3>${t("settings.general", "General Settings")}</h3>
          <div class="settings-group"><label class="settings-label">${t("settings.language", "Language")}</label><select class="modal-select" data-setting="language"><option value="zh" ${settings.language === "zh" ? "selected" : ""}>中文</option><option value="en" ${settings.language === "en" ? "selected" : ""}>English</option></select></div>
          <div class="settings-group"><label class="settings-label">${t("settings.startupBehavior", "Startup Behavior")}</label><select class="modal-select" data-setting="startupBehavior"><option value="restore" ${settings.startupBehavior === "restore" ? "selected" : ""}>${t("settings.restoreLast", "Restore Last Session")}</option><option value="fresh" ${settings.startupBehavior === "fresh" ? "selected" : ""}>${t("settings.freshStart", "Fresh Start")}</option><option value="minimized" ${settings.startupBehavior === "minimized" ? "selected" : ""}>${t("settings.minimized", "Start Minimized")}</option></select></div>
          <div class="settings-group"><label class="settings-label">${t("settings.closeBehavior", "Close Behavior")}</label><select class="modal-select" data-setting="closeBehavior"><option value="close" ${settings.closeBehavior === "close" ? "selected" : ""}>${t("settings.closeWindow", "Close Window")}</option><option value="minimize" ${settings.closeBehavior === "minimize" ? "selected" : ""}>${t("settings.minimizeToTray", "Minimize to Tray")}</option><option value="quit" ${settings.closeBehavior === "quit" ? "selected" : ""}>${t("settings.quitApp", "Quit Application")}</option></select></div>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="checkUpdates" ${settings.checkUpdates ? "checked" : ""} /><span>${t("settings.checkUpdates", "Check for Updates")}</span></label></div>
        </div>
        <div class="settings-panel" data-settings-panel="appearance" style="display:none">
          <h3>${t("settings.appearance", "Appearance Settings")}</h3>
          <div class="settings-group"><label class="settings-label">${t("settings.theme", "Theme")}</label><select class="modal-select" data-setting="theme"><option value="dark" ${settings.theme === "dark" ? "selected" : ""}>${t("settings.dark", "Dark")}</option><option value="light" ${settings.theme === "light" ? "selected" : ""}>${t("settings.light", "Light")}</option><option value="system" ${settings.theme === "system" ? "selected" : ""}>${t("settings.system", "System")}</option></select></div>
          <div class="settings-group"><label class="settings-label">${t("settings.fontSize", "Font Size")}</label><input type="range" min="12" max="20" value="${settings.fontSize}" data-setting="fontSize" class="settings-slider" /><span class="settings-value">${settings.fontSize}px</span></div>
          <div class="settings-group"><label class="settings-label">${t("settings.accentColor", "Accent Color")}</label><input type="color" value="${settings.accentColor}" data-setting="accentColor" class="settings-color" /></div>
          <div class="settings-group"><label class="settings-label">${t("settings.glassOpacity", "Glass Opacity")}</label><input type="range" min="0" max="100" value="${settings.glassOpacity}" data-setting="glassOpacity" class="settings-slider" /><span class="settings-value">${settings.glassOpacity}%</span></div>
        </div>
        <div class="settings-panel" data-settings-panel="terminal" style="display:none">
          <h3>${t("settings.terminal", "Terminal Settings")}</h3>
          <div class="settings-group"><label class="settings-label">${t("settings.defaultTerminal", "Default Terminal")}</label><select class="modal-select" data-setting="terminalDefault"><option value="system" ${settings.terminalDefault === "system" ? "selected" : ""}>${t("settings.systemDefault", "System Default")}</option><option value="iterm2" ${settings.terminalDefault === "iterm2" ? "selected" : ""}>iTerm2</option><option value="kitty" ${settings.terminalDefault === "kitty" ? "selected" : ""}>Kitty</option><option value="alacritty" ${settings.terminalDefault === "alacritty" ? "selected" : ""}>Alacritty</option><option value="wezterm" ${settings.terminalDefault === "wezterm" ? "selected" : ""}>WezTerm</option></select></div>
          <div class="settings-group"><label class="settings-label">${t("settings.shellPath", "Shell Path")}</label><input type="text" class="modal-input" value="${escapeHtml(settings.terminalShellPath)}" data-setting="terminalShellPath" placeholder="/bin/zsh" /></div>
          <div class="settings-group"><label class="settings-label">${t("settings.terminalFontSize", "Terminal Font Size")}</label><input type="range" min="10" max="24" value="${settings.terminalFontSize}" data-setting="terminalFontSize" class="settings-slider" /><span class="settings-value">${settings.terminalFontSize}px</span></div>
        </div>
        <div class="settings-panel" data-settings-panel="proxy" style="display:none">
          <h3>${t("settings.proxy", "Proxy Settings")}</h3>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="proxyEnabled" ${settings.proxyEnabled ? "checked" : ""} /><span>${t("settings.enableProxy", "Enable Proxy")}</span></label></div>
          <div class="settings-group"><label class="settings-label">${t("settings.proxyUrl", "Proxy URL")}</label><input type="text" class="modal-input" value="${escapeHtml(settings.proxyUrl)}" data-setting="proxyUrl" placeholder="http://127.0.0.1:7890" /><p class="form-hint">${t("settings.proxyHint", "Supports HTTP/HTTPS/SOCKS5")}</p></div>
          <div class="settings-group"><label class="settings-label">${t("settings.gatewayAccessKey", "Gateway Access Key")}</label><input type="password" class="modal-input" value="${escapeHtml(settings.gatewayAccessKey || "")}" data-setting="gatewayAccessKey" placeholder="${t("settings.gatewayAccessKeyPlaceholder", "Optional bearer token")}" /><p class="form-hint">${t("settings.gatewayAccessKeyHint", "Used as Authorization bearer token")}</p></div>
        </div>
        <div class="settings-panel" data-settings-panel="failover" style="display:none">
          <h3>${t("settings.failover", "Failover Settings")}</h3>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="autoFailover" ${settings.autoFailover ? "checked" : ""} /><span>${t("settings.autoFailover", "Auto Failover")}</span></label></div>
          <div class="settings-group"><label class="settings-label">${t("settings.failoverThreshold", "Failure Threshold")}</label><input type="number" class="modal-input" value="${settings.failoverThreshold}" data-setting="failoverThreshold" min="1" max="100" /><p class="form-hint">${t("settings.failoverThresholdHint", "Consecutive failures before switching provider")}</p></div>
          <div class="settings-group"><label class="settings-label">${t("settings.circuitBreakerTimeout", "Circuit Breaker Timeout (s)")}</label><input type="number" class="modal-input" value="${settings.circuitBreakerTimeout}" data-setting="circuitBreakerTimeout" min="10" max="3600" /></div>
        </div>
        <div class="settings-panel" data-settings-panel="privacy" style="display:none">
          <h3>${t("settings.privacy", "Privacy Settings")}</h3>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="telemetryEnabled" ${settings.telemetryEnabled ? "checked" : ""} /><span>${t("settings.telemetry", "Enable Telemetry")}</span></label></div>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="crashReporting" ${settings.crashReporting ? "checked" : ""} /><span>${t("settings.crashReporting", "Crash Reporting")}</span></label></div>
          <div class="settings-group"><label class="settings-label">${t("settings.sessionRetention", "Session Retention (days)")}</label><input type="number" class="modal-input" value="${settings.sessionRetentionDays}" data-setting="sessionRetentionDays" min="1" max="365" /></div>
        </div>
        <div class="settings-panel" data-settings-panel="backup" data-control-area="backup" style="display:none">
          <h3>${t("settings.backup", "Backup & Restore")}</h3>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="autoBackup" ${settings.autoBackup ? "checked" : ""} /><span>${t("settings.autoBackup", "Auto Backup")}</span></label></div>
          <div class="settings-group"><label class="settings-label">${t("settings.backupInterval", "Backup Interval (hours)")}</label><input type="number" class="modal-input" value="${settings.autoBackupInterval}" data-setting="autoBackupInterval" min="1" max="168" /></div>
          ${settings.lastBackupAt ? '<p class="form-hint">' + t("settings.lastBackup", "Last backup") + ': ' + escapeHtml(settings.lastBackupAt) + '</p>' : ""}
          <div class="settings-actions">
            <button type="button" class="modal-btn modal-btn--primary" data-action="export-config">${t("settings.exportConfig", "Export Config")}</button>
            <button type="button" class="modal-btn modal-btn--ghost" data-action="import-config">${t("settings.importConfig", "Import Config")}</button>
            <button type="button" class="modal-btn modal-btn--ghost" data-action="create-backup">${t("settings.createBackup", "Create Backup")}</button>
          </div>
        </div>
        <div class="settings-panel" data-settings-panel="webdav" data-control-area="webdav" style="display:none">
          <h3>${t("settings.webdav", "WebDAV Sync")}</h3>
          <div class="settings-group"><label class="settings-toggle-label"><input type="checkbox" data-setting="webdavEnabled" ${settings.webdavEnabled ? "checked" : ""} /><span>${t("settings.enableWebdav", "Enable WebDAV")}</span></label></div>
          <div class="settings-group"><label class="settings-label">${t("settings.webdavUrl", "WebDAV URL")}</label><input type="text" class="modal-input" value="${escapeHtml(settings.webdavUrl || "")}" data-setting="webdavUrl" placeholder="https://dav.example.com/agentsoul/" /></div>
          <div class="settings-group"><label class="settings-label">${t("settings.webdavUser", "Username")}</label><input type="text" class="modal-input" value="${escapeHtml(settings.webdavUser || "")}" data-setting="webdavUser" /></div>
          <div class="settings-group"><label class="settings-label">${t("settings.webdavPassword", "Password")}</label><input type="password" class="modal-input" value="" data-setting="webdavPassword" /></div>
          <div class="settings-actions">
            <button type="button" class="modal-btn modal-btn--primary" data-action="test-webdav">${t("settings.testWebdav", "Test Connection")}</button>
            <button type="button" class="modal-btn modal-btn--ghost" data-action="sync-webdav">${t("settings.syncWebdav", "Sync Now")}</button>
          </div>
        </div>
      </div>
    </section>
  `;
}
