/**
 * Shared Shell — renderAgentSoulShell and renderDesktopCompanionWidget
 * The main shell layout that composes all area sections.
 */
import type { CompanionRuntimeSnapshot, DesktopApprovalRequest, DesktopRiskNotice, NativeCompanionRuntimeState } from "../types";
import { t, escapeHtml, resolveVisualState, faceForState } from "./utils";
import { defaultCompanionSnapshot } from "../data/defaultSnapshot";
import { renderCompanionViewModel } from "../areas/companion/render";
import { renderApprovalRequired, renderRiskNotices } from "../areas/safety/render";
import { renderControlCenterTaskNavigation } from "./nav";
import { renderAppSwitcher } from "./app-switcher";
import { renderCompanionArea } from "../areas/companion/render";
import { renderGatewayArea } from "../areas/gateway/render";
import { renderCostsArea } from "../areas/costs/render";
import { renderSkillsArea } from "../areas/skills/render";
import { renderSessionsArea } from "../areas/sessions/render";
import { renderConversationsArea } from "../areas/conversations/render";
import { renderSafetyArea } from "../areas/safety/render";
import { renderSettingsArea, renderDeepLinkImportDialog } from "../areas/settings/render";
import { renderSettingsFullArea } from "../areas/settings-full/render";
import { renderSessionsMgrArea } from "../areas/sessions-mgr/render";
import { renderMcpArea } from "../areas/mcp/render";
import { renderPromptsArea } from "../areas/prompts/render";
import { tauriInvoke } from "../utils/tauriIpc";

export function renderAgentSoulShell(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot = defaultCompanionSnapshot,
  lastInteractionStatus?: string,
  pendingApproval?: DesktopApprovalRequest,
  riskNotices: DesktopRiskNotice[] = [],
): void {
  const viewModel = {
    ...renderCompanionViewModel(snapshot),
    lastInteractionStatus,
    pendingApproval,
    riskNotices,
  };
  const companion = snapshot?.companion || defaultCompanionSnapshot.companion;
  const vitalsObj = companion.vitals || defaultCompanionSnapshot.companion.vitals;

  const vitalKeys = ["level", "xp", "energy", "hunger", "intimacy"];
  const vitalPercentages = [
    Math.min(100, ((vitalsObj.level || 0) / 10) * 100),
    Math.min(100, vitalsObj.xp || 0),
    vitalsObj.companionEnergy || 0,
    vitalsObj.hunger || 0,
    vitalsObj.intimacy || 0
  ];

  // @ts-ignore
  const i18nInstance = typeof globalThis.i18nInstance !== "undefined" ? globalThis.i18nInstance : undefined;

  target.innerHTML = `
    <section class="shell" aria-label="AgentSoul v2 desktop shell" data-state="${viewModel.visualState}" data-active-tab="${(typeof localStorage !== "undefined" && localStorage.getItem("agentsoul_active_tab")) || "companion"}">
      <aside class="companion-panel sidebar-panel" aria-label="Desktop Companion">
        <div class="sidebar-header">
          <div class="app-brand">
            <span class="brand-title">${t("common.appName", "AgentSoul v2")}</span>
            <button type="button" data-locale-toggle class="locale-toggle-btn">${i18nInstance && i18nInstance.language === "zh" ? "EN" : "中文"}</button>
          </div>
        </div>
        <div class="companion-visual-section">
          <div class="companion-orb companion-orb--${viewModel.visualState}" aria-label="${escapeHtml(viewModel.name)} ${viewModel.visualState}">
            <canvas class="companion-canvas clean-avatar" width="200" height="200" style="width: 100%; height: 100%; display: block;"></canvas>
            <span class="companion-face" aria-hidden="true" style="display: none;">${faceForState(viewModel.visualState)}</span>
          </div>
          <div class="companion-identity">
            <h1>${escapeHtml(viewModel.name)}</h1>
            <p class="appearance-desc">${escapeHtml(viewModel.appearanceLabel)}</p>
            <p class="summary">${t("common.appDesc", "Local-first AI Agent Companion for the Desktop Companion and Control Center.")}</p>
          </div>
        </div>
        <dl class="vitals">
          ${viewModel.vitals.map((vital, index) => {
            const key = vitalKeys[index] || "unknown";
            const pct = vitalPercentages[index] ?? 50;
            return `<div class="vital vital--${key}"><dt>${escapeHtml(vital.label)}</dt><dd>${escapeHtml(vital.value)}</dd><div class="vital-bar"><div class="vital-bar-fill" style="width: ${pct}%"></div></div></div>`;
          }).join("")}
        </dl>
        <div class="interactions" aria-label="Companion interactions">
          <button type="button" data-interaction="feed">${t("common.feed", "Feed")}</button>
          <button type="button" data-interaction="play">${t("common.play", "Play")}</button>
          <button type="button" data-interaction="pet">${t("common.pet", "Pet")}</button>
          <button type="button" data-interaction="sleep">${t("common.sleep", "Sleep")}</button>
        </div>
        ${renderApprovalRequired(viewModel.pendingApproval)}
        ${renderRiskNotices(viewModel.riskNotices)}
        ${viewModel.lastInteractionStatus ? `<p class="interaction-status" role="status">${escapeHtml(viewModel.lastInteractionStatus)}</p>` : ""}
        <p class="route">${escapeHtml(viewModel.providerRouteLabel)}</p>
      </aside>
      <main class="main-content">
        ${renderAppSwitcher(snapshot.appSwitcher)}
        ${renderControlCenterTaskNavigation()}
        ${renderCompanionArea(snapshot)}
        ${renderGatewayArea(snapshot)}
        ${renderCostsArea(snapshot)}
        ${renderSkillsArea(snapshot)}
        ${renderSessionsArea(snapshot)}
        ${renderConversationsArea(snapshot)}
        ${renderSafetyArea(snapshot)}
        ${renderSettingsArea(snapshot)}
        ${renderSessionsMgrArea(snapshot)}
        ${renderMcpArea(snapshot)}
        ${renderPromptsArea(snapshot)}
        ${renderSettingsFullArea(snapshot)}
        ${renderDeepLinkImportDialog(snapshot.deepLinkImport)}
        <footer class="usage-footer" aria-label="Usage Summary">
          <p>${t("usage.totalSessions", "Total Sessions")}: ${snapshot.growthHistory?.length ?? 0}</p>
          <p>${t("usage.companionLevel", "Companion Level")}: ${snapshot.companion?.vitals?.level ?? 1}</p>
        </footer>
      </main>
    </section>
  `;
}

export function renderDesktopCompanionWidget(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot = defaultCompanionSnapshot,
  lastInteractionStatus?: string,
): void {
  const state = snapshot.companion.activityState ?? resolveVisualState(snapshot);
  const summary = snapshot.companion.summary ?? t("common.appDesc", "Local-first companion");
  const updatedAt = snapshot.companion.lastUpdatedAt ?? "";
  target.innerHTML = `
    <section class="pet-widget" data-state="${escapeHtml(String(state))}" aria-label="Desktop Companion Widget" data-tauri-drag-region>
      <div class="pet-widget__character" data-pet-widget-trigger>
        <canvas class="companion-canvas clean-avatar" width="220" height="220" style="width: 100%; height: 100%; display: block;"></canvas>
      </div>
      <div class="pet-widget__status">
        <strong>${escapeHtml(snapshot.companion.displayName)}</strong>
        <span>${escapeHtml(summary)}</span>
        ${updatedAt ? `<time>${escapeHtml(updatedAt)}</time>` : ""}
        ${lastInteractionStatus ? `<p role="status">${escapeHtml(lastInteractionStatus)}</p>` : ""}
      </div>
      <button type="button" class="pet-widget__menu-btn" data-pet-menu-trigger aria-label="Open companion menu">...</button>
    </section>
  `;
}

export function loadCompanionRuntimeSnapshot(): Promise<CompanionRuntimeSnapshot> {
  return (async () => {
    try {
      const nativeState = await tauriInvoke<NativeCompanionRuntimeState>("get_companion_runtime_state");
      const merged = mergeNativeCompanionRuntimeState(defaultCompanionSnapshot, nativeState);
      const assetPackPath = merged.companion.petAppearance.assetPackPath;
      if (!assetPackPath) return merged;
      try {
        const packResult = await tauriInvoke<{ assetPackPath: string; manifest: unknown; validation: { level: "ok" | "warning" | "error"; messages: string[] } }>("load_pet_asset_pack", { assetPackPath });
        return {
          ...merged,
          companion: {
            ...merged.companion,
            petAppearance: { ...merged.companion.petAppearance, assetManifest: (packResult.manifest as any) ?? undefined, assetValidation: packResult.validation },
          },
        };
      } catch { return merged; }
    } catch { return defaultCompanionSnapshot; }
  })();
}

export function mergeNativeCompanionRuntimeState(
  fallback: CompanionRuntimeSnapshot,
  nativeState: NativeCompanionRuntimeState,
): CompanionRuntimeSnapshot {
  return {
    ...fallback,
    companion: {
      ...fallback.companion,
      ...nativeState.companion,
      petAppearance: { ...fallback.companion.petAppearance, ...nativeState.companion?.petAppearance },
      vitals: { ...fallback.companion.vitals, ...nativeState.companion?.vitals },
      autonomy: mergeAutonomySnapshot(fallback.companion.autonomy, nativeState.companion?.autonomy),
    },
    providerProfile: { ...fallback.providerProfile, ...nativeState.providerProfile },
  };
}

function mergeAutonomySnapshot(
  fallback: CompanionRuntimeSnapshot["companion"]["autonomy"],
  native: CompanionRuntimeSnapshot["companion"]["autonomy"] | undefined,
): NonNullable<CompanionRuntimeSnapshot["companion"]["autonomy"]> {
  return {
    userPresence: native?.userPresence ?? fallback?.userPresence ?? "PRESENT",
    companionMode: native?.companionMode ?? fallback?.companionMode ?? "AUTONOMOUS",
    lastEventPriority: native?.lastEventPriority ?? fallback?.lastEventPriority ?? "LOW",
    lastOutputStrategy: native?.lastOutputStrategy ?? fallback?.lastOutputStrategy ?? "silent",
    queuedOutputCount: native?.queuedOutputCount ?? fallback?.queuedOutputCount ?? 0,
    lastAction: native?.lastAction ?? fallback?.lastAction,
    cooldownUntil: native?.cooldownUntil ?? fallback?.cooldownUntil,
  };
}
