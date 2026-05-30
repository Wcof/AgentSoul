// Desktop Companion 入口文件 — 重新导出拆分后的子模块
import "./styles.css";

export * from "./types";
export * from "./renderers";
export * from "./controller";
export * from "./canvas-renderer";

// 启动应用
import { defaultCompanionSnapshot } from "./renderers";
import { createDesktopCompanionController, loadCompanionRuntimeSnapshot } from "./controller";
import { createLocalControlClient } from "./utils/localControlClient";
import { initWindowSnap } from "./utils/windowSnap";
import i18n from "./i18n";

// Gateway base URL — configurable via window.__AGENSOUL_GATEWAY_URL or env
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

  // 初始化桌面伴侣窗口自动吸附（仅 desktop-companion 模式）
  if (shellMode === "desktop-companion") {
    void initWindowSnap();
  }

  // 创建本地控制面客户端
  const controlClient = createLocalControlClient({
    gatewayBase: GATEWAY_BASE,
    accessKey: readGatewayAccessKey(),
  });

  // 加载伴侣原生状态（Tauri invoke 或 fallback）
  const baseSnapshot = await loadCompanionRuntimeSnapshot();

  // 从权威存储加载业务状态（Gateway channels, MCP, sessions）
  let snapshot = baseSnapshot;
  let gatewayAvailable = false;
  try {
    const authoritativeSnapshot = await controlClient.loadSnapshot();
    snapshot = {
      ...baseSnapshot,
      costs: authoritativeSnapshot.costs,
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
    // Gateway 不可用 — 使用空业务状态，不展示演示数据
    snapshot = {
      ...baseSnapshot,
      costs: baseSnapshot.costs,
      channels: [],
      dashboardStats: {
        totalChannels: 0, activeChannels: 0, totalRequests: 0,
        totalEstimatedCost: 0, overallSuccessRate: 100,
        totalInputTokens: 0, totalOutputTokens: 0,
      },
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

  // Restore locally managed states for panels that are local-first by design.
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
    async performInteraction(kind) {
      return {
        outcome: kind === "play" && snapshot.companion.vitals.companionEnergy < 20
          ? "blocked-low-energy"
          : "applied",
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
  if (next.length === 0) {
    localStorage.removeItem("agentsoul_gateway_access_key");
  } else {
    localStorage.setItem("agentsoul_gateway_access_key", next);
  }
}

function hydrateLocalPanelState(snapshot: typeof defaultCompanionSnapshot): typeof defaultCompanionSnapshot {
  if (typeof localStorage === "undefined") return snapshot;
  let next = snapshot;
  try {
    const rawWebdav = localStorage.getItem("agentsoul_webdav_sync");
    if (rawWebdav) {
      const parsed = JSON.parse(rawWebdav);
      next = {
        ...next,
        webdavSync: {
          ...next.webdavSync,
          ...parsed,
          config: {
            ...next.webdavSync.config,
            ...(parsed?.config || {}),
          },
        },
      };
    }
  } catch {
    // Ignore invalid local webdav cache.
  }
  try {
    const rawActiveApp = localStorage.getItem("agentsoul_active_app");
    if (rawActiveApp && rawActiveApp in next.appSwitcher.visibleApps) {
      next = {
        ...next,
        appSwitcher: {
          ...next.appSwitcher,
          activeApp: rawActiveApp as typeof next.appSwitcher.activeApp,
        },
      };
    }
  } catch {
    // Ignore invalid active app cache.
  }
  return next;
}

function isSupportedLocale(value: unknown): value is "zh" | "en" {
  return value === "zh" || value === "en";
}

async function detectShellMode(): Promise<"desktop-companion" | "control-center"> {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = getCurrentWebviewWindow().label;
    return label === "desktop-companion" ? "desktop-companion" : "control-center";
  } catch {
    return "control-center";
  }
}
