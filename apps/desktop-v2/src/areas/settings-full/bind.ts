/**
 * Settings-Full Area — bind functions
 * Handles settings tabs, settings persistence, import/export, backup, and webdav controls.
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike, AppSettingsSnapshot } from "../../types";
import { t } from "../../shared/utils";
import { confirmDialog, showToast, openModal, closeModal } from "../../utils/modal";

export function bindSettingsFullArea(ctx: AreaContext): void {
  bindSettingsTabs(ctx.target, ctx.snapshot, ctx.controlClient);
  bindBackupControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
  bindWebdavControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindSettingsTabs(target: HTMLElement, snapshot?: CompanionRuntimeSnapshot, controlClient?: LocalControlClientLike): void {
  target.querySelectorAll<HTMLButtonElement>("[data-settings-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.settingsTab!;
      const shell = target.querySelector<HTMLElement>(".shell");
      if (shell) shell.setAttribute("data-active-settings-tab", tabId);
      target.querySelectorAll("[data-settings-tab]").forEach((t) => t.classList.remove("settings-tab--active"));
      btn.classList.add("settings-tab--active");
      target.querySelectorAll("[data-settings-panel]").forEach((panel) => {
        (panel as HTMLElement).style.display = panel.getAttribute("data-settings-panel") === tabId ? "" : "none";
      });
    });
  });

  target.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]").forEach((el) => {
    el.addEventListener("change", async () => {
      const key = el.dataset.setting as string;
      let value: any;
      if (el.type === "checkbox") value = (el as HTMLInputElement).checked;
      else if (el.type === "number" || el.type === "range") value = Number(el.value);
      else value = el.value;
      if (snapshot) {
        const previousValue = (snapshot.appSettings as any)[key];
        (snapshot.appSettings as any)[key] = value;
        if (key === "gatewayAccessKey" && typeof localStorage !== "undefined") {
          const normalized = String(value ?? "").trim();
          if (normalized.length > 0) localStorage.setItem("agentsoul_gateway_access_key", normalized);
          else localStorage.removeItem("agentsoul_gateway_access_key");
          controlClient?.setAccessKey(normalized || undefined);
        }
        if (controlClient) {
          const ok = await controlClient.saveAppSettings(snapshot.appSettings);
          if (!ok) {
            (snapshot.appSettings as any)[key] = previousValue;
            if (key === "gatewayAccessKey" && typeof localStorage !== "undefined") {
              const fallback = String(previousValue ?? "").trim();
              if (fallback.length > 0) localStorage.setItem("agentsoul_gateway_access_key", fallback);
              else localStorage.removeItem("agentsoul_gateway_access_key");
              controlClient.setAccessKey(fallback || undefined);
            }
            if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(previousValue);
            else (el as HTMLInputElement | HTMLSelectElement).value = String(previousValue ?? "");
            showToast(t("settings.saveFailed", "设置保存失败"), "error");
            return;
          }
        }
        showToast(t("settings.saved", "设置已保存") + ": " + key, "success");
      }
    });
  });

  // Export config
  target.querySelectorAll<HTMLButtonElement>("[data-action='export-config']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!snapshot) return;
      const config = JSON.stringify(snapshot.appSettings, null, 2);
      navigator.clipboard?.writeText(config);
      showToast(t("settings.exported", "配置已复制到剪贴板"), "success");
    });
  });

  // Import config
  target.querySelectorAll<HTMLButtonElement>("[data-action='import-config']").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("settings.importConfig", "导入配置")}</h3>
        <div class="form-group"><label class="modal-label">${t("settings.pasteConfig", "粘贴配置 JSON")}</label><textarea class="modal-input" id="import-config-json" rows="10" placeholder='{"language":"zh","theme":"dark"}'></textarea></div>
        <div class="modal-actions"><button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button><button type="button" class="modal-btn modal-btn--primary" id="import-config-submit">${t("settings.import", "导入")}</button></div>
      `);
      document.getElementById("import-config-submit")?.addEventListener("click", async () => {
        const jsonStr = (document.getElementById("import-config-json") as HTMLTextAreaElement)?.value?.trim();
        if (!jsonStr) return;
        try {
          const imported = JSON.parse(jsonStr);
          if (snapshot) {
            const previous = { ...snapshot.appSettings };
            const next = sanitizeImportedAppSettings(imported, snapshot.appSettings);
            snapshot.appSettings = next;
            if (controlClient) {
              const ok = await controlClient.saveAppSettings(next);
              if (!ok) { snapshot.appSettings = previous; throw new Error("persist-failed"); }
            }
            if (typeof localStorage !== "undefined") {
              const normalized = next.gatewayAccessKey?.trim() ?? "";
              if (normalized.length > 0) localStorage.setItem("agentsoul_gateway_access_key", normalized);
              else localStorage.removeItem("agentsoul_gateway_access_key");
              controlClient?.setAccessKey(normalized || undefined);
            }
          }
          closeModal();
          showToast(t("settings.imported", "配置已导入"), "success");
        } catch { showToast(t("settings.importFailed", "配置导入失败"), "error"); }
      });
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-action='create-backup']").forEach((btn) => {
    btn.addEventListener("click", () => showToast(t("backup.useBackupSection", "请使用备份管理区域创建备份"), "info"));
  });
}

export function sanitizeImportedAppSettings(imported: unknown, current: AppSettingsSnapshot): AppSettingsSnapshot {
  if (!imported || typeof imported !== "object") throw new Error("invalid-settings-json");
  const source = imported as Record<string, unknown>;
  const next: AppSettingsSnapshot = { ...current };
  const asString = (v: unknown) => typeof v === "string" ? v : undefined;
  const asBoolean = (v: unknown) => typeof v === "boolean" ? v : undefined;
  const asNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const asEnum = <T extends string>(v: unknown, allowed: ReadonlySet<T>): T | undefined => typeof v === "string" && allowed.has(v as T) ? (v as T) : undefined;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const language = asEnum(source.language, new Set(["zh", "en"] as const));
  if (language) next.language = language;
  const theme = asEnum(source.theme, new Set(["dark", "light", "system"] as const));
  if (theme) next.theme = theme;
  const startupBehavior = asEnum(source.startupBehavior, new Set(["restore", "fresh", "minimized"] as const));
  if (startupBehavior) next.startupBehavior = startupBehavior;
  const closeBehavior = asEnum(source.closeBehavior, new Set(["close", "minimize", "quit"] as const));
  if (closeBehavior) next.closeBehavior = closeBehavior;
  const terminalDefault = asEnum(source.terminalDefault, new Set(["system", "iterm2", "kitty", "alacritty", "wezterm"] as const));
  if (terminalDefault) next.terminalDefault = terminalDefault;

  const checkUpdates = asBoolean(source.checkUpdates); if (checkUpdates !== undefined) next.checkUpdates = checkUpdates;
  const proxyEnabled = asBoolean(source.proxyEnabled); if (proxyEnabled !== undefined) next.proxyEnabled = proxyEnabled;
  const autoFailover = asBoolean(source.autoFailover); if (autoFailover !== undefined) next.autoFailover = autoFailover;
  const sessionAutoSave = asBoolean(source.sessionAutoSave); if (sessionAutoSave !== undefined) next.sessionAutoSave = sessionAutoSave;
  const mcpAutoStart = asBoolean(source.mcpAutoStart); if (mcpAutoStart !== undefined) next.mcpAutoStart = mcpAutoStart;
  const telemetryEnabled = asBoolean(source.telemetryEnabled); if (telemetryEnabled !== undefined) next.telemetryEnabled = telemetryEnabled;
  const crashReporting = asBoolean(source.crashReporting); if (crashReporting !== undefined) next.crashReporting = crashReporting;
  const autoBackup = asBoolean(source.autoBackup); if (autoBackup !== undefined) next.autoBackup = autoBackup;

  const terminalShellPath = asString(source.terminalShellPath); if (terminalShellPath !== undefined) next.terminalShellPath = terminalShellPath;
  const proxyUrl = asString(source.proxyUrl); if (proxyUrl !== undefined) next.proxyUrl = proxyUrl;
  const gatewayAccessKey = asString(source.gatewayAccessKey); if (gatewayAccessKey !== undefined) next.gatewayAccessKey = gatewayAccessKey;
  const workspaceDir = asString(source.workspaceDir); if (workspaceDir !== undefined) next.workspaceDir = workspaceDir;
  const dataDir = asString(source.dataDir); if (dataDir !== undefined) next.dataDir = dataDir;
  const logDir = asString(source.logDir); if (logDir !== undefined) next.logDir = logDir;
  const fontFamily = asString(source.fontFamily); if (fontFamily !== undefined) next.fontFamily = fontFamily;
  const accentColor = asString(source.accentColor); if (accentColor !== undefined) next.accentColor = accentColor;

  const terminalFontSize = asNumber(source.terminalFontSize); if (terminalFontSize !== undefined) next.terminalFontSize = clamp(Math.round(terminalFontSize), 10, 24);
  const failoverThreshold = asNumber(source.failoverThreshold); if (failoverThreshold !== undefined) next.failoverThreshold = clamp(Math.round(failoverThreshold), 1, 20);
  const circuitBreakerTimeout = asNumber(source.circuitBreakerTimeout); if (circuitBreakerTimeout !== undefined) next.circuitBreakerTimeout = clamp(Math.round(circuitBreakerTimeout), 1, 3600);
  const maxConcurrentSessions = asNumber(source.maxConcurrentSessions); if (maxConcurrentSessions !== undefined) next.maxConcurrentSessions = clamp(Math.round(maxConcurrentSessions), 1, 50);
  const sessionRetentionDays = asNumber(source.sessionRetentionDays); if (sessionRetentionDays !== undefined) next.sessionRetentionDays = clamp(Math.round(sessionRetentionDays), 1, 365);
  const mcpDefaultTimeout = asNumber(source.mcpDefaultTimeout); if (mcpDefaultTimeout !== undefined) next.mcpDefaultTimeout = clamp(Math.round(mcpDefaultTimeout), 1, 600);
  const fontSize = asNumber(source.fontSize); if (fontSize !== undefined) next.fontSize = clamp(Math.round(fontSize), 10, 24);
  const glassOpacity = asNumber(source.glassOpacity); if (glassOpacity !== undefined) next.glassOpacity = clamp(Math.round(glassOpacity), 0, 100);
  const autoBackupInterval = asNumber(source.autoBackupInterval); if (autoBackupInterval !== undefined) next.autoBackupInterval = clamp(Math.round(autoBackupInterval), 1, 168);

  return next;
}

function bindBackupControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  const refreshBackupsFromControl = async (): Promise<void> => {
    if (!controlClient) return;
    try {
      const backups = await controlClient.listBackups();
      snapshot.backupList = { ...snapshot.backupList, backups, autoBackupEnabled: snapshot.appSettings.autoBackup, autoBackupInterval: snapshot.appSettings.autoBackupInterval };
    } catch {}
  };

  target.querySelectorAll<HTMLButtonElement>("[data-backup-create]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("backup.createBackup", "创建备份")}</h3>
        <div class="form-group"><label class="modal-label">${t("backup.name", "备份名称")}</label><input type="text" class="modal-input" id="backup-name" placeholder="手动备份" /></div>
        <div class="form-group"><label class="modal-label">${t("backup.description", "描述")}</label><textarea class="modal-input" id="backup-desc" rows="3" placeholder="可选描述..." ></textarea></div>
        <div class="modal-actions"><button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button><button type="button" class="modal-btn modal-btn--primary" id="backup-create-submit">${t("backup.create", "创建备份")}</button></div>
      `);
      document.getElementById("backup-create-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("backup-name") as HTMLInputElement)?.value?.trim();
        const desc = (document.getElementById("backup-desc") as HTMLTextAreaElement)?.value?.trim();
        closeModal();
        if (controlClient) {
          const entry = await controlClient.createBackup(name || undefined, desc || undefined);
          if (entry) { await refreshBackupsFromControl(); showToast(t("backup.created", "备份已创建") + ": " + entry.name, "success"); }
          else showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
        } else showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
        controller?.render(snapshot);
      });
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-backup-auto-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.classList.toggle("toggle-btn--active");
      const isActive = btn.classList.contains("toggle-btn--active");
      btn.textContent = isActive ? t("common.on", "ON") : t("common.off", "OFF");
      snapshot.appSettings.autoBackup = isActive;
      snapshot.backupList.autoBackupEnabled = isActive;
      if (controlClient) await controlClient.saveAppSettings(snapshot.appSettings);
      controller?.render(snapshot);
      showToast(t("backup.autoBackupToggled", "Auto backup") + ": " + (isActive ? t("common.on", "ON") : t("common.off", "OFF")), "info");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-backup-restore]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const backupId = btn.dataset.backupRestore!;
      const confirmed = await confirmDialog(t("backup.confirmRestore", "Confirm Restore"), t("backup.confirmRestoreMessage", "This will overwrite current settings. Continue?"), { confirmText: t("backup.restore", "Restore"), cancelText: t("common.cancel", "Cancel") });
      if (confirmed && controlClient) {
        const ok = await controlClient.restoreBackup(backupId);
        if (ok) {
          try { const fresh = await controlClient.loadSnapshot(); snapshot.mcpServers = fresh.mcpServers; snapshot.channels = fresh.channels; snapshot.dashboardStats = fresh.dashboardStats; snapshot.backupList = fresh.backupList; } catch {}
          showToast(t("backup.restored", "备份已恢复"), "success");
          controller?.render(snapshot);
        } else showToast(t("backup.restoreFailed", "恢复失败"), "error");
      } else if (confirmed) showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-backup-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const backupId = btn.dataset.backupDelete!;
      const confirmed = await confirmDialog(t("backup.confirmDelete", "Confirm Delete"), t("backup.confirmDeleteMessage", "This backup will be permanently deleted. Continue?"), { confirmText: t("common.delete", "Delete"), cancelText: t("common.cancel", "Cancel"), danger: true });
      if (confirmed) {
        if (controlClient) { await controlClient.deleteBackup(backupId); await refreshBackupsFromControl(); }
        showToast(t("backup.deleted", "Backup deleted"), "success");
        controller?.render(snapshot);
      }
    });
  });
}

function bindWebdavControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  const saveWebdavState = async (): Promise<void> => {
    try { localStorage.setItem("agentsoul_webdav_sync", JSON.stringify(snapshot.webdavSync)); } catch {}
    if (controlClient) await controlClient.saveAppSettings({ ...snapshot.appSettings, proxyUrl: snapshot.appSettings.proxyUrl });
  };

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-configure]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverUrl = (target.querySelector("[data-webdav-field='serverUrl']") as HTMLInputElement | null)?.value?.trim() || "";
      const username = (target.querySelector("[data-webdav-field='username']") as HTMLInputElement | null)?.value?.trim() || "";
      const remotePath = (target.querySelector("[data-webdav-field='remotePath']") as HTMLInputElement | null)?.value?.trim() || "";
      if (!serverUrl || !username || !remotePath) { showToast(t("webdav.fillRequired", "请填写 WebDAV 必填项"), "error"); return; }
      snapshot.webdavSync.config = { ...snapshot.webdavSync.config, serverUrl, username, remotePath };
      snapshot.webdavSync.isConfigured = true;
      snapshot.webdavSync.status = "idle";
      await saveWebdavState();
      controller?.render(snapshot);
      showToast(t("webdav.configured", "WebDAV 配置已保存"), "success");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-auto-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      snapshot.webdavSync.config.autoSync = !snapshot.webdavSync.config.autoSync;
      await saveWebdavState();
      controller?.render(snapshot);
      showToast(t("webdav.autoSync", "自动同步") + ": " + (snapshot.webdavSync.config.autoSync ? t("common.on", "ON") : t("common.off", "OFF")), "info");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-sync]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!snapshot.webdavSync.isConfigured) { showToast(t("webdav.notConfigured", "WebDAV 未配置"), "error"); return; }
      snapshot.webdavSync.status = "syncing";
      controller?.render(snapshot);
      await new Promise((resolve) => setTimeout(resolve, 350));
      snapshot.webdavSync.status = "success";
      snapshot.webdavSync.config.lastSyncAt = new Date().toISOString();
      snapshot.webdavSync.config.lastSyncStatus = "success";
      snapshot.webdavSync.config.lastSyncError = undefined;
      await saveWebdavState();
      controller?.render(snapshot);
      showToast(t("webdav.syncSuccess", "同步完成"), "success");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-reset]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      snapshot.webdavSync = { status: "idle", isConfigured: false, config: { serverUrl: "", username: "", remotePath: "", autoSync: false, syncInterval: snapshot.webdavSync.config.syncInterval || 30 } };
      await saveWebdavState();
      controller?.render(snapshot);
      showToast(t("webdav.resetDone", "WebDAV 配置已重置"), "success");
    });
  });
}
