/**
 * Settings Area — bind functions
 * Handles locale switching, persona template selection, and deep link import dialog wiring.
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike, DeepLinkType } from "../../types";
import { t } from "../../shared/utils";
import { showToast } from "../../utils/modal";

export function bindSettingsArea(ctx: AreaContext): void {
  bindLocaleToggle(ctx.target, ctx.controller);
  bindPersonaSelection(ctx.target, ctx.snapshot);
  bindDeepLinkImportControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindLocaleToggle(target: HTMLElement, controller: DesktopCompanionController): void {
  target.querySelectorAll<HTMLButtonElement>("[data-locale-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const i18n = (await import("../../i18n")).default;
        const next = i18n.language === "zh" ? "en" : "zh";
        await i18n.changeLanguage(next);
        controller.render();
      } catch (e) { console.warn("[AgentSoul] Locale toggle failed:", e); }
    });
  });
  target.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const i18n = (await import("../../i18n")).default;
        await i18n.changeLanguage(btn.dataset.locale!);
        controller.render();
      } catch (e) { console.warn("[AgentSoul] Locale change failed:", e); }
    });
  });
}

export function bindPersonaSelection(target: HTMLElement, snapshot: CompanionRuntimeSnapshot): void {
  target.querySelectorAll<HTMLElement>("[data-persona-select]").forEach((el) => {
    el.addEventListener("click", () => {
      const templateId = el.dataset.personaSelect!;
      const tpl = snapshot.personaTemplates.find((t) => t.id === templateId);
      if (!tpl) return;
      el.closest(".persona-grid")?.querySelectorAll(".persona-card").forEach((card) => card.classList.remove("persona-card--active"));
      el.classList.add("persona-card--active");
      showToast(t("settings.personaApplied", "人格模板已应用") + ": " + tpl.nameZh, "success");
    });
  });
}

export function bindDeepLinkImportControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  const syncFromControlSnapshot = async (): Promise<void> => {
    if (!controlClient) return;
    try {
      const fresh = await controlClient.loadSnapshot();
      snapshot.channels = fresh.channels;
      snapshot.dashboardStats = fresh.dashboardStats;
      snapshot.skills = fresh.skills;
      snapshot.sessions = fresh.sessions;
      snapshot.localSessions = fresh.localSessions;
      snapshot.conversationDashboard = fresh.conversationDashboard;
      snapshot.prompts = fresh.prompts;
      snapshot.appSettings = fresh.appSettings;
      snapshot.keyTrend = { ...snapshot.keyTrend, ...fresh.keyTrend, duration: snapshot.keyTrend.duration, view: snapshot.keyTrend.view };
      snapshot.modelStats = { ...snapshot.modelStats, ...fresh.modelStats, duration: snapshot.modelStats.duration, view: snapshot.modelStats.view };
    } catch { /* Keep local optimistic state */ }
  };

  target.querySelectorAll<HTMLButtonElement>("[data-deeplink-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = target.querySelector<HTMLDialogElement>("[data-dialog='deeplink-import']");
      if (dialog && typeof dialog.showModal === "function") dialog.showModal();
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-deeplink-parse]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = target.querySelector<HTMLTextAreaElement>("[data-deeplink-input]");
      const lines = (input?.value || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const parsed = lines.map((line) => {
        try {
          const u = new URL(line);
          const type = (u.searchParams.get("type") || "config") as DeepLinkType;
          return { type, url: line, name: u.searchParams.get("name") || undefined, description: u.searchParams.get("desc") || undefined, parsedConfig: Object.fromEntries(u.searchParams.entries()) };
        } catch { return null; }
      }).filter(Boolean) as typeof snapshot.deepLinkImport.links;
      snapshot.deepLinkImport.links = parsed;
      snapshot.deepLinkImport.lastImportResult = undefined;
      controller?.render(snapshot);
      const dialog = target.querySelector<HTMLDialogElement>("[data-dialog='deeplink-import']");
      if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
      showToast(t("deeplink.parsed", "链接解析完成") + `: ${parsed.length}`, "success");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-deeplink-run]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (snapshot.deepLinkImport.links.length === 0) { showToast(t("deeplink.noLinks", "没有可导入的链接"), "info"); return; }
      snapshot.deepLinkImport.isImporting = true;
      snapshot.deepLinkImport.importProgress = 0;
      controller?.render(snapshot);

      let importedCount = 0;
      for (const link of snapshot.deepLinkImport.links) {
        const cfg = (link.parsedConfig || {}) as Record<string, string>;
        if (link.type === "channel" && controlClient) {
          const name = cfg.name || link.name || "Imported Channel";
          const baseUrl = cfg.baseUrl || cfg.url || "";
          const apiType = cfg.type || "openai-chat";
          if (baseUrl) { try { await controlClient.createChannel({ name, type: apiType, baseUrl, apiKeys: cfg.apiKey ? [cfg.apiKey] : [] }); importedCount++; } catch {} }
        } else if (link.type === "config" && controlClient) {
          const nextSettings = { ...snapshot.appSettings };
          if (cfg.language === "zh" || cfg.language === "en") nextSettings.language = cfg.language;
          if (cfg.theme === "dark" || cfg.theme === "light" || cfg.theme === "system") nextSettings.theme = cfg.theme;
          await controlClient.saveAppSettings(nextSettings);
          snapshot.appSettings = nextSettings;
          importedCount++;
        } else if (link.type === "skill" && controlClient) {
          const skillPackId = cfg.skillPackId || cfg.id || link.name || "imported-skill";
          if (!snapshot.skills.projectActivations.find((item) => item.skillPackId === skillPackId)) {
            snapshot.skills.projectActivations.push({ skillPackId, enabled: true, source: "project" });
            await controlClient.saveSkillsState(snapshot.skills);
          }
          importedCount++;
        } else { importedCount++; }
        snapshot.deepLinkImport.importProgress = Math.round((importedCount / snapshot.deepLinkImport.links.length) * 100);
        controller?.render(snapshot);
      }

      snapshot.deepLinkImport.isImporting = false;
      snapshot.deepLinkImport.lastImportResult = { success: true, importedCount, message: t("deeplink.importSuccess", "导入完成") };
      await syncFromControlSnapshot();
      controller?.render(snapshot);
      const dialog = target.querySelector<HTMLDialogElement>("[data-dialog='deeplink-import']");
      if (dialog && dialog.open) dialog.close();
      showToast(t("deeplink.importSuccess", "导入完成") + `: ${importedCount}`, "success");
    });
  });
}
