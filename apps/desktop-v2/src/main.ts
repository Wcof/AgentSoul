// Desktop Companion entry — uses area modules (Issue #114)
import "./styles.css";

// Re-export everything for backward compatibility
export * from "./types";
export * from "./renderers";
export * from "./controller";
export * from "./canvas-renderer";

// Bootstrap the application
import { defaultCompanionSnapshot } from "./data/defaultSnapshot";
import { loadCompanionRuntimeSnapshot } from "./shared/shell";
import { createDesktopCompanionController } from "./shared/app-controller";
import { createLocalControlClient } from "./utils/localControlClient";
import { initWindowSnap } from "./utils/windowSnap";
import i18n from "./i18n";

// Area array — used by the shell render for tab-based display
import { renderCompanionArea } from "./areas/companion/render";
import { renderGatewayArea } from "./areas/gateway/render";
import { renderCostsArea } from "./areas/costs/render";
import { renderSkillsArea } from "./areas/skills/render";
import { renderSessionsArea } from "./areas/sessions/render";
import { renderConversationsArea } from "./areas/conversations/render";
import { renderSafetyArea } from "./areas/safety/render";
import { renderSettingsArea } from "./areas/settings/render";
import { renderSettingsFullArea } from "./areas/settings-full/render";
import { renderSessionsMgrArea } from "./areas/sessions-mgr/render";
import { renderMcpArea } from "./areas/mcp/render";
import { renderPromptsArea } from "./areas/prompts/render";

import { bindCompanionArea } from "./areas/companion/bind";
import { bindGatewayArea } from "./areas/gateway/bind";
import { bindCostsArea } from "./areas/costs/bind";
import { bindSkillsArea } from "./areas/skills/bind";
import { bindSessionsArea } from "./areas/sessions/bind";
import { bindConversationsArea } from "./areas/conversations/bind";
import { bindSafetyArea } from "./areas/safety/bind";
import { bindSettingsArea } from "./areas/settings/bind";
import { bindSettingsFullArea } from "./areas/settings-full/bind";
import { bindSessionsMgrArea } from "./areas/sessions-mgr/bind";
import { bindMcpArea } from "./areas/mcp/bind";
import { bindPromptsArea } from "./areas/prompts/bind";

import type { CompanionRuntimeSnapshot } from "./types";

/** Area registry — each area has an id, render function, and bind function */
const areas = [
  { id: "companion", render: renderCompanionArea, bind: bindCompanionArea },
  { id: "gateway", render: renderGatewayArea, bind: bindGatewayArea },
  { id: "costs", render: renderCostsArea, bind: bindCostsArea },
  { id: "skills", render: renderSkillsArea, bind: bindSkillsArea },
  { id: "sessions", render: renderSessionsArea, bind: bindSessionsArea },
  { id: "conversations", render: renderConversationsArea, bind: bindConversationsArea },
  { id: "safety", render: renderSafetyArea, bind: bindSafetyArea },
  { id: "settings", render: renderSettingsArea, bind: bindSettingsArea },
  { id: "settings-full", render: renderSettingsFullArea, bind: bindSettingsFullArea },
  { id: "sessions-mgr", render: renderSessionsMgrArea, bind: bindSessionsMgrArea },
  { id: "mcp", render: renderMcpArea, bind: bindMcpArea },
  { id: "prompts", render: renderPromptsArea, bind: bindPromptsArea },
];

export { areas };

// Gateway base URL
const GATEWAY_BASE =
  (typeof window !== "undefined" && (window as any).__AGENSOUL_GATEWAY_URL) ||
  (typeof process !== "undefined" && process.env?.AGENSOUL_GATEWAY_URL) ||
  "http://127.0.0.1:3001";

const app = document.querySelector<HTMLElement>("#app");

if (app) {
  void bootstrapDesktopCompanion(app);
}

async function bootstrapDesktopCompanion(app: HTMLElement): Promise<void> {
  const shellMode = await detectShellMode();
  document.body.classList.toggle("desktop-companion-mode", shellMode === "desktop-companion");
  document.body.classList.toggle("control-center-mode", shellMode === "control-center");

  if (shellMode === "desktop-companion") {
    void initWindowSnap();
  }

  const controlClient = createLocalControlClient({
    gatewayBase: GATEWAY_BASE,
    accessKey: readGatewayAccessKey(),
  });

  const baseSnapshot = await loadCompanionRuntimeSnapshot();

  let snapshot = baseSnapshot;
  let gatewayAvailable = false;
  try {
    const authoritativeSnapshot = await controlClient.loadSnapshot();
    snapshot = {
      ...baseSnapshot,
      costs: authoritativeSnapshot.costs,
      gateway: authoritativeSnapshot.gateway,
      channels: authoritativeSnapshot.channels,
      dashboardStats: authoritativeSnapshot.dashboardStats,
      keyTrend: authoritativeSnapshot.keyTrend,
      modelStats: authoritativeSnapshot.modelStats,
      appSwitcher: authoritativeSnapshot.appSwitcher,
      usageFooter: authoritativeSnapshot.usageFooter,
      backupList: authoritativeSnapshot.backupList,
      webdavSync: authoritativeSnapshot.webdavSync,
      deepLinkImport: authoritativeSnapshot.deepLinkImport,
      sessions: authoritativeSnapshot.sessions,
      conversationDashboard: authoritativeSnapshot.conversationDashboard,
      safety: authoritativeSnapshot.safety,
      skills: authoritativeSnapshot.skills,
      mcpServers: authoritativeSnapshot.mcpServers,
      localSessions: authoritativeSnapshot.localSessions,
      prompts: authoritativeSnapshot.prompts,
      appSettings: authoritativeSnapshot.appSettings,
    };
    gatewayAvailable = true;
  } catch {
    snapshot = {
      ...baseSnapshot,
      costs: baseSnapshot.costs,
      channels: [],
      dashboardStats: { totalChannels: 0, activeChannels: 0, totalRequests: 0, totalEstimatedCost: 0, overallSuccessRate: 100, totalInputTokens: 0, totalOutputTokens: 0 },
      keyTrend: baseSnapshot.keyTrend,
      modelStats: baseSnapshot.modelStats,
      appSwitcher: baseSnapshot.appSwitcher,
      usageFooter: baseSnapshot.usageFooter,
      backupList: baseSnapshot.backupList,
      webdavSync: baseSnapshot.webdavSync,
      deepLinkImport: baseSnapshot.deepLinkImport,
      conversationDashboard: baseSnapshot.conversationDashboard,
      mcpServers: [],
      localSessions: [],
    };
  }

  snapshot = hydrateLocalPanelState(snapshot);

  if (isSupportedLocale(snapshot.appSettings?.language) && i18n.language !== snapshot.appSettings.language) {
    await i18n.changeLanguage(snapshot.appSettings.language);
  }
  persistGatewayAccessKey(snapshot.appSettings?.gatewayAccessKey);

  createDesktopCompanionController({
    target: app,
    shellMode,
    initialSnapshot: snapshot,
    controlClient,
    gatewayAvailable,
    async performInteraction(kind: import("./types").CompanionInteractionKind) {
      return {
        outcome: kind === "play" && snapshot.companion.vitals.companionEnergy < 20 ? "blocked-low-energy" : "applied",
        state: snapshot,
      };
    },
  });
}

function readGatewayAccessKey(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem("agentsoul_gateway_access_key");
  const value = raw?.trim();
  return value ? value : undefined;
}

function persistGatewayAccessKey(value: string | undefined): void {
  if (typeof localStorage === "undefined") return;
  const next = value?.trim() ?? "";
  if (next.length === 0) localStorage.removeItem("agentsoul_gateway_access_key");
  else localStorage.setItem("agentsoul_gateway_access_key", next);
}

function hydrateLocalPanelState(snapshot: typeof defaultCompanionSnapshot): typeof defaultCompanionSnapshot {
  if (typeof localStorage === "undefined") return snapshot;
  let next = snapshot;
  try {
    const rawWebdav = localStorage.getItem("agentsoul_webdav_sync");
    if (rawWebdav) {
      const parsed = JSON.parse(rawWebdav);
      next = { ...next, webdavSync: { ...next.webdavSync, ...parsed, config: { ...next.webdavSync.config, ...(parsed?.config || {}) } } };
    }
  } catch {}
  try {
    const rawActiveApp = localStorage.getItem("agentsoul_active_app");
    if (rawActiveApp && rawActiveApp in next.appSwitcher.visibleApps) {
      next = { ...next, appSwitcher: { ...next.appSwitcher, activeApp: rawActiveApp as typeof next.appSwitcher.activeApp } };
    }
  } catch {}
  return next;
}

function isSupportedLocale(value: unknown): value is "zh" | "en" {
  return value === "zh" || value === "en";
}

async function detectShellMode(): Promise<"desktop-companion" | "control-center"> {
  const queryMode = readShellModeFromUrl();
  if (queryMode) return queryMode;

  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = getCurrentWebviewWindow().label;
    return label === "desktop-companion" ? "desktop-companion" : "control-center";
  } catch {
    return "control-center";
  }
}

function readShellModeFromUrl(): "desktop-companion" | "control-center" | undefined {
  if (typeof window === "undefined") return undefined;
  const mode = new URLSearchParams(window.location.search).get("shellMode");
  if (mode === "desktop-companion" || mode === "control-center") return mode;
  return undefined;
}
