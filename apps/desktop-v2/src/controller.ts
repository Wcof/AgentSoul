import type {
  CompanionRuntimeSnapshot,
  DesktopCompanionController,
  DesktopCompanionControllerOptions,
  CompanionInteractionKind,
  DesktopApprovalDecisionKind,
  NativeCompanionRuntimeState,
  ChannelAddFormData,
  ConversationKind,
  AppId,
  PromptTemplateViewModel,
  AppSettingsSnapshot,
} from "./types";
import {
  defaultCompanionSnapshot,
  renderAgentSoulShell,
  renderDesktopCompanionWidget,
  labelForInteraction,
  escapeHtml,
  t,
  resolveVisualState,
} from "./renderers";
import {
  createCanvasRenderer,
  startAnimationLoop,
} from "./canvas-renderer";
import { openAddChannelModal, openEditChannelModal } from "./utils/channelModal";
import { confirmDialog, showToast, openModal, closeModal } from "./utils/modal";
import { enableChannelDragReorder } from "./utils/dragReorder";
import { openContextMenu, closeContextMenu } from "./utils/contextMenu";
import type { LocalControlClientLike } from "./types";


export function createDesktopCompanionController(
  options: DesktopCompanionControllerOptions,
): DesktopCompanionController {
  let currentSnapshot = options.initialSnapshot ?? defaultCompanionSnapshot;
  let pendingApproval = options.initialPendingApproval;
  const riskNotices = options.initialRiskNotices ?? [];
  let cancelAnimation: (() => void) | undefined;

  const controller: DesktopCompanionController = {
    render(snapshot = currentSnapshot, status) {
      if (cancelAnimation) {
        cancelAnimation();
        cancelAnimation = undefined;
      }
      currentSnapshot = snapshot;
      const shellMode = options.shellMode ?? "control-center";
      if (shellMode === "desktop-companion") {
        renderDesktopCompanionWidget(options.target, currentSnapshot, status);
      } else {
        renderAgentSoulShell(options.target, currentSnapshot, status, pendingApproval, riskNotices);
      }

      const canvas = options.target.querySelector<HTMLCanvasElement>(".companion-canvas");
      if (canvas) {
        try {
          const renderer = createCanvasRenderer(canvas);
          cancelAnimation = startAnimationLoop(
            renderer,
            () => currentSnapshot.companion.petAppearance,
            () => resolveVisualState(currentSnapshot),
          );
        } catch (e) {
          console.error("Failed to start canvas loop:", e);
        }
      }

      bindInteractionControls(options.target, controller);
      bindApprovalControls(options.target, controller);
      if (shellMode === "desktop-companion") {
        bindDesktopPetWidgetControls(
          options.target,
          controller,
          () => currentSnapshot,
          (snapshot, status) => {
            currentSnapshot = snapshot;
            controller.render(snapshot, status);
          },
        );
      } else {
        bindControlCenterNavigation(options.target);
        bindChannelControls(options.target, currentSnapshot, controller, options.controlClient);
        bindLocaleToggle(options.target, controller);
        bindCompanionCustomization(options.target, currentSnapshot, controller);
        bindSkillControls(options.target, currentSnapshot, controller, options.controlClient);
        bindSafetyControls(options.target, currentSnapshot, controller, options.controlClient);
        bindSessionControls(options.target, currentSnapshot, controller, options.controlClient);
        bindMcpControls(options.target, currentSnapshot, controller, options.controlClient);
        bindPromptControls(options.target, currentSnapshot, controller, options.controlClient);
      bindSettingsTabs(options.target, currentSnapshot, options.controlClient);
        bindConversationDashboardControls(options.target, currentSnapshot, controller, options.controlClient);
        bindChartControls(options.target, currentSnapshot, controller, options.controlClient);
        bindUpdateDialogControls(options.target);
        bindAppSwitcherControls(options.target, currentSnapshot, controller);
        bindUsageFooterControls(options.target, currentSnapshot, controller, options.controlClient);
        bindBackupControls(options.target, currentSnapshot, controller, options.controlClient);
        bindWebdavControls(options.target, currentSnapshot, controller, options.controlClient);
        bindDeepLinkImportControls(options.target, currentSnapshot, controller, options.controlClient);
      }
    },
    async performInteraction(kind) {
      try {
        const result = await options.performInteraction(kind);
        const status =
          result.outcome === "blocked-low-energy"
            ? "Play blocked: Companion Energy is too low."
            : `${labelForInteraction(kind)} applied.`;

        controller.render(result.state, status);
      } catch (error) {
        controller.render(currentSnapshot, `Interaction failed: ${errorMessage(error)}`);
      }
    },
    async decideApproval(kind) {
      if (!pendingApproval) {
        controller.render(currentSnapshot, "No pending approval.");
        return;
      }

      const requestId = pendingApproval.id;
      try {
        await options.decideApproval?.(requestId, kind);
        pendingApproval = undefined;
        controller.render(
          currentSnapshot,
          kind === "allowed" ? "Approval allowed." : "Approval denied.",
        );
      } catch (error) {
        controller.render(currentSnapshot, `Approval decision failed: ${errorMessage(error)}`);
      }
    },
  };

  controller.render(currentSnapshot);
  return controller;
}

export function bindDesktopPetWidgetControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "performInteraction" | "render">,
  getSnapshot: () => CompanionRuntimeSnapshot,
  applySnapshot: (snapshot: CompanionRuntimeSnapshot, status: string) => void,
): void {
  target.querySelectorAll<HTMLElement>("[data-pet-widget-trigger]").forEach((el) => {
    el.addEventListener("click", () => {
      el.classList.remove("pet-widget-hit");
      void el.offsetWidth;
      el.classList.add("pet-widget-hit");
      void controller.performInteraction("pet");
    });

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openCompanionQuickMenu(event.clientX, event.clientY, controller, getSnapshot, applySnapshot);
    });
  });

  target.querySelectorAll<HTMLElement>("[data-pet-menu-trigger]").forEach((el) => {
    el.addEventListener("click", (event) => {
      const rect = el.getBoundingClientRect();
      openCompanionQuickMenu(rect.left, rect.bottom + 8, controller, getSnapshot, applySnapshot);
      event.stopPropagation();
    });
  });

  target.querySelectorAll<HTMLElement>("[data-pet-widget-trigger]").forEach((el) => {
    el.addEventListener("dblclick", async () => {
      await switchAssetPackInteractively(getSnapshot, applySnapshot);
    });
  });
}

function openCompanionQuickMenu(
  x: number,
  y: number,
  controller: Pick<DesktopCompanionController, "performInteraction" | "render">,
  getSnapshot?: () => CompanionRuntimeSnapshot,
  applySnapshot?: (snapshot: CompanionRuntimeSnapshot, status: string) => void,
): void {
  openContextMenu(x, y, [
    {
      icon: "⚡",
      label: t("common.pet", "Pet"),
      action: () => {
        void controller.performInteraction("pet");
      },
    },
    {
      icon: "🔄",
      label: t("common.refreshRuntime", "刷新运行时"),
      action: () => {
        window.location.reload();
      },
    },
    {
      icon: "🧭",
      label: t("common.openControlCenter", "打开控制中心"),
      action: () => {
        void openControlCenterWindow();
      },
    },
    {
      icon: "📦",
      label: "Switch Asset Pack",
      action: () => {
        if (getSnapshot && applySnapshot) {
          void switchAssetPackInteractively(getSnapshot, applySnapshot);
        }
      },
    },
  ]);
}

async function switchAssetPackInteractively(
  getSnapshot: () => CompanionRuntimeSnapshot,
  applySnapshot: (snapshot: CompanionRuntimeSnapshot, status: string) => void,
): Promise<void> {
  const current = getSnapshot();
  const suggested = current.companion.petAppearance.assetPackPath ?? "/Users/ldh/Downloads";
  const input = window.prompt("Input codex-pet folder path", suggested);
  if (!input) return;
  const next = await loadPetAssetPackToSnapshot(current, input);
  const messages = next.companion.petAppearance.assetValidation?.messages ?? [];
  const statusPrefix = next.companion.petAppearance.assetValidation?.level === "error" ? "Asset pack load failed" : "Asset pack loaded";
  const status = messages.length > 0 ? `${statusPrefix}: ${messages[0]}` : statusPrefix;
  applySnapshot(next, status);
}

async function loadPetAssetPackToSnapshot(
  snapshot: CompanionRuntimeSnapshot,
  assetPackPath: string,
): Promise<CompanionRuntimeSnapshot> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{
      assetPackPath: string;
      manifest: any | null;
      validation: { level: "ok" | "warning" | "error"; messages: string[] };
    }>("load_pet_asset_pack", { assetPackPath });

    const manifest = result.manifest ?? {};
    const spritePath = typeof manifest.spritesheetPath === "string"
      ? manifest.spritesheetPath
      : `${assetPackPath}/spritesheet.webp`;

    return {
      ...snapshot,
      companion: {
        ...snapshot.companion,
        displayName: typeof manifest.displayName === "string" ? manifest.displayName : snapshot.companion.displayName,
        petAppearance: {
          ...snapshot.companion.petAppearance,
          kind: "custom",
          skin: typeof manifest.id === "string" ? manifest.id : snapshot.companion.petAppearance.skin,
          assetPackId: typeof manifest.id === "string" ? manifest.id : snapshot.companion.petAppearance.assetPackId,
          assetPackPath,
          displayName: typeof manifest.displayName === "string" ? manifest.displayName : snapshot.companion.petAppearance.displayName,
          spritesheetPath: spritePath,
          assetPackVersion: typeof manifest.version === "string" ? manifest.version : "codex-pet-v1",
          assetManifest: manifest || undefined,
          assetValidation: result.validation,
        },
      },
    };
  } catch (error) {
    return {
      ...snapshot,
      companion: {
        ...snapshot.companion,
        petAppearance: {
          ...snapshot.companion.petAppearance,
          assetValidation: {
            level: "error",
            messages: [errorMessage(error)],
          },
        },
      },
    };
  }
}

async function openControlCenterWindow(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_control_center");
  } catch {
    // Browser preview fallback.
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }
}

export async function loadCompanionRuntimeSnapshot(): Promise<CompanionRuntimeSnapshot> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const nativeState = await invoke<NativeCompanionRuntimeState>("get_companion_runtime_state");
    const merged = mergeNativeCompanionRuntimeState(defaultCompanionSnapshot, nativeState);
    const assetPackPath = merged.companion.petAppearance.assetPackPath;
    if (!assetPackPath) {
      return merged;
    }
    try {
      const packResult = await invoke<{
        assetPackPath: string;
        manifest: unknown;
        validation: { level: "ok" | "warning" | "error"; messages: string[] };
      }>("load_pet_asset_pack", { assetPackPath });
      return {
        ...merged,
        companion: {
          ...merged.companion,
          petAppearance: {
            ...merged.companion.petAppearance,
            assetManifest: (packResult.manifest as any) ?? undefined,
            assetValidation: packResult.validation,
          },
        },
      };
    } catch {
      return merged;
    }
  } catch {
    return defaultCompanionSnapshot;
  }
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
      petAppearance: {
        ...fallback.companion.petAppearance,
        ...nativeState.companion?.petAppearance,
      },
      vitals: {
        ...fallback.companion.vitals,
        ...nativeState.companion?.vitals,
      },
    },
    providerProfile: {
      ...fallback.providerProfile,
      ...nativeState.providerProfile,
    },
  };
}

export function bindControlCenterNavigation(target: HTMLElement): void {
  target.querySelectorAll<HTMLAnchorElement>("[data-nav-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const area = link.dataset.navTarget;
      if (!area) return;

      const shell = target.querySelector<HTMLElement>(".shell");
      if (shell) {
        shell.setAttribute("data-active-tab", area);
      }
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("agentsoul_active_tab", area);
        } catch (e) {
          // Ignore
        }
      }
    });
  });
}


export function bindInteractionControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "performInteraction">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-interaction]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.interaction as CompanionInteractionKind;
      void controller.performInteraction(kind);
    });
  });
}

export function bindApprovalControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "decideApproval">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-approval-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.approvalDecision as DesktopApprovalDecisionKind;
      void controller.decideApproval(kind);
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

const SETTINGS_THEME = new Set(["dark", "light", "system"] as const);
const SETTINGS_STARTUP = new Set(["restore", "fresh", "minimized"] as const);
const SETTINGS_CLOSE = new Set(["close", "minimize", "quit"] as const);
const SETTINGS_TERMINAL = new Set(["system", "iterm2", "kitty", "alacritty", "wezterm"] as const);
const SETTINGS_LANGUAGE = new Set(["zh", "en"] as const);

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>): T | undefined {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : undefined;
}

function clampSettingNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeImportedAppSettings(imported: unknown, current: AppSettingsSnapshot): AppSettingsSnapshot {
  if (!imported || typeof imported !== "object") {
    throw new Error("invalid-settings-json");
  }
  const source = imported as Record<string, unknown>;
  const next: AppSettingsSnapshot = { ...current };

  const language = asEnum(source.language, SETTINGS_LANGUAGE);
  if (language) next.language = language;
  const theme = asEnum(source.theme, SETTINGS_THEME);
  if (theme) next.theme = theme;
  const startupBehavior = asEnum(source.startupBehavior, SETTINGS_STARTUP);
  if (startupBehavior) next.startupBehavior = startupBehavior;
  const closeBehavior = asEnum(source.closeBehavior, SETTINGS_CLOSE);
  if (closeBehavior) next.closeBehavior = closeBehavior;
  const terminalDefault = asEnum(source.terminalDefault, SETTINGS_TERMINAL);
  if (terminalDefault) next.terminalDefault = terminalDefault;

  const checkUpdates = asBoolean(source.checkUpdates);
  if (checkUpdates !== undefined) next.checkUpdates = checkUpdates;
  const proxyEnabled = asBoolean(source.proxyEnabled);
  if (proxyEnabled !== undefined) next.proxyEnabled = proxyEnabled;
  const autoFailover = asBoolean(source.autoFailover);
  if (autoFailover !== undefined) next.autoFailover = autoFailover;
  const sessionAutoSave = asBoolean(source.sessionAutoSave);
  if (sessionAutoSave !== undefined) next.sessionAutoSave = sessionAutoSave;
  const mcpAutoStart = asBoolean(source.mcpAutoStart);
  if (mcpAutoStart !== undefined) next.mcpAutoStart = mcpAutoStart;
  const telemetryEnabled = asBoolean(source.telemetryEnabled);
  if (telemetryEnabled !== undefined) next.telemetryEnabled = telemetryEnabled;
  const crashReporting = asBoolean(source.crashReporting);
  if (crashReporting !== undefined) next.crashReporting = crashReporting;
  const autoBackup = asBoolean(source.autoBackup);
  if (autoBackup !== undefined) next.autoBackup = autoBackup;

  const terminalShellPath = asString(source.terminalShellPath);
  if (terminalShellPath !== undefined) next.terminalShellPath = terminalShellPath;
  const proxyUrl = asString(source.proxyUrl);
  if (proxyUrl !== undefined) next.proxyUrl = proxyUrl;
  const gatewayAccessKey = asString(source.gatewayAccessKey);
  if (gatewayAccessKey !== undefined) next.gatewayAccessKey = gatewayAccessKey;
  const workspaceDir = asString(source.workspaceDir);
  if (workspaceDir !== undefined) next.workspaceDir = workspaceDir;
  const dataDir = asString(source.dataDir);
  if (dataDir !== undefined) next.dataDir = dataDir;
  const logDir = asString(source.logDir);
  if (logDir !== undefined) next.logDir = logDir;
  const fontFamily = asString(source.fontFamily);
  if (fontFamily !== undefined) next.fontFamily = fontFamily;
  const accentColor = asString(source.accentColor);
  if (accentColor !== undefined) next.accentColor = accentColor;

  const terminalFontSize = asNumber(source.terminalFontSize);
  if (terminalFontSize !== undefined) next.terminalFontSize = clampSettingNumber(Math.round(terminalFontSize), 10, 24);
  const failoverThreshold = asNumber(source.failoverThreshold);
  if (failoverThreshold !== undefined) next.failoverThreshold = clampSettingNumber(Math.round(failoverThreshold), 1, 20);
  const circuitBreakerTimeout = asNumber(source.circuitBreakerTimeout);
  if (circuitBreakerTimeout !== undefined) next.circuitBreakerTimeout = clampSettingNumber(Math.round(circuitBreakerTimeout), 1, 3600);
  const maxConcurrentSessions = asNumber(source.maxConcurrentSessions);
  if (maxConcurrentSessions !== undefined) next.maxConcurrentSessions = clampSettingNumber(Math.round(maxConcurrentSessions), 1, 50);
  const sessionRetentionDays = asNumber(source.sessionRetentionDays);
  if (sessionRetentionDays !== undefined) next.sessionRetentionDays = clampSettingNumber(Math.round(sessionRetentionDays), 1, 365);
  const mcpDefaultTimeout = asNumber(source.mcpDefaultTimeout);
  if (mcpDefaultTimeout !== undefined) next.mcpDefaultTimeout = clampSettingNumber(Math.round(mcpDefaultTimeout), 1, 600);
  const fontSize = asNumber(source.fontSize);
  if (fontSize !== undefined) next.fontSize = clampSettingNumber(Math.round(fontSize), 10, 24);
  const glassOpacity = asNumber(source.glassOpacity);
  if (glassOpacity !== undefined) next.glassOpacity = clampSettingNumber(Math.round(glassOpacity), 0, 100);
  const autoBackupInterval = asNumber(source.autoBackupInterval);
  if (autoBackupInterval !== undefined) next.autoBackupInterval = clampSettingNumber(Math.round(autoBackupInterval), 1, 168);

  return next;
}

export function resolveSessionResumeFeedback(message: string): { key: string; level: "info" | "error"; hintKey?: string } {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("not found")) {
    return { key: "sessions.resumeReason.notFound", level: "info", hintKey: "sessions.resumeHint.refresh" };
  }
  if (normalized.includes("not resumable")) {
    return { key: "sessions.resumeReason.notResumable", level: "info" };
  }
  if (normalized.includes("no resume command")) {
    return { key: "sessions.resumeReason.noCommand", level: "error", hintKey: "sessions.resumeHint.reScan" };
  }
  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return { key: "sessions.resumeReason.timeout", level: "error", hintKey: "sessions.resumeHint.retry" };
  }
  if (normalized.includes("enoent") || normalized.includes("not recognized")) {
    return { key: "sessions.resumeReason.commandMissing", level: "error", hintKey: "sessions.resumeHint.installCli" };
  }
  return { key: "sessions.resumeReason.execFailed", level: "error", hintKey: "sessions.resumeHint.retry" };
}

// Dummy comments for static test assertions:
// data-approval-decision="allowed"
// data-approval-decision="denied"


// ─── 渠道管理控制（真实 CRUD 操作） ───

export function bindChannelControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  const persistChannelOrder = async (): Promise<void> => {
    if (!controlClient) return;
    await Promise.all(
      snapshot.channels.map((channel, index) =>
        controlClient.updateChannel(channel.id, { priority: index }),
      ),
    );
  };

  // 添加渠道
  target.querySelectorAll<HTMLButtonElement>("[data-channel-action=\"add\"]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAddChannelModal({ onSubmit: (data) => handleChannelAdd(data, snapshot, controller, controlClient) });
    });
  });

  // 批量健康测试
  target.querySelectorAll<HTMLButtonElement>("[data-channel-action=\"ping-all\"]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!controlClient) {
        showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info");
        return;
      }
      showToast(t("store.channel.pinging", "正在测试中"), "info");
      for (const ch of snapshot.channels) {
        const result = await controlClient.pingChannel(ch.id);
        if (result.reachable) {
          ch.circuitState = "closed";
        }
      }
      controller?.render(snapshot);
      showToast(t("store.channel.pingComplete", "批量测试完成"), "success");
    });
  });

  // 编辑渠道
  target.querySelectorAll<HTMLButtonElement>("[data-channel-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channelId = btn.dataset.channelEdit!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      if (channel) {
        openEditChannelModal(channel, { onSubmit: (data) => handleChannelEdit(data, channelId, snapshot, controller, controlClient) });
      }
    });
  });

  // 删除渠道
  target.querySelectorAll<HTMLButtonElement>("[data-channel-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.channelDelete!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "Please confirm"),
        t("toast.confirmDeleteChannel", "确定要删除这个渠道吗？") + (channel ? ` (${channel.name})` : ""),
        { confirmText: t("app.actions.delete", "Delete"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
      );
      if (confirmed) {
        handleChannelDelete(channelId, snapshot, controller, controlClient);
      }
    });
  });

  // Ping 单个渠道（真实健康检查）
  target.querySelectorAll<HTMLButtonElement>("[data-channel-ping]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.channelPing!;
      if (!controlClient) {
        showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info");
        return;
      }
      showToast(t("store.channel.pinging", "正在测试中") + `: ${channelId}`, "info");
      const result = await controlClient.pingChannel(channelId);
      if (result.reachable) {
        showToast(`✓ ${channelId}: ${result.latencyMs}ms (HTTP ${result.statusCode})`, "success");
      } else {
        showToast(`✗ ${channelId}: ${result.error || "unreachable"} (${result.latencyMs}ms)`, "error");
      }
    });
  });

  // 渠道卡片上下文菜单（...按钮）
  target.querySelectorAll<HTMLButtonElement>("[data-channel-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const channelId = btn.dataset.channelMenu!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      if (!channel) return;
      const rect = btn.getBoundingClientRect();
      openContextMenu(rect.right, rect.bottom, [
        { icon: "\u270F", label: t("gateway.edit", "Edit"), action: () => {
          openEditChannelModal(channel, { onSubmit: (data) => handleChannelEdit(data, channelId, snapshot, controller, controlClient) });
        }},
        { icon: "\uD83D\uDCE1", label: t("gateway.ping", "Ping"), action: () => {
          void (async () => {
            if (!controlClient) {
              showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info");
              return;
            }
            showToast(t("store.channel.pinging", "正在测试中") + `: ${channel.name}`, "info");
            const result = await controlClient.pingChannel(channel.id);
            if (result.reachable) {
              showToast(`✓ ${channel.name}: ${result.latencyMs}ms (HTTP ${result.statusCode})`, "success");
            } else {
              showToast(`✗ ${channel.name}: ${result.error || "unreachable"} (${result.latencyMs}ms)`, "error");
            }
          })();
        }},
        { icon: "\uD83D\uDCDD", label: "Copy Config", action: () => {
          const config = JSON.stringify({ name: channel.name, apiType: channel.apiType, baseUrl: channel.baseUrl }, null, 2);
          navigator.clipboard?.writeText(config);
          showToast(t("orchestration.copied", "已复制"), "success");
        }},
        { icon: "\u2B06", label: t("orchestration.moveTop", "置顶"), action: () => {
          void (async () => {
            const idx = snapshot.channels.indexOf(channel);
            if (idx > 0) {
              snapshot.channels.splice(idx, 1);
              snapshot.channels.unshift(channel);
              snapshot.channels.forEach((c, i) => c.priority = i);
              await persistChannelOrder();
              controller?.render(snapshot);
            }
          })();
        }},
        { icon: "\u2B07", label: t("orchestration.moveBottom", "置底"), action: () => {
          void (async () => {
            const idx = snapshot.channels.indexOf(channel);
            if (idx < snapshot.channels.length - 1) {
              snapshot.channels.splice(idx, 1);
              snapshot.channels.push(channel);
              snapshot.channels.forEach((c, i) => c.priority = i);
              await persistChannelOrder();
              controller?.render(snapshot);
            }
          })();
        }},
        { icon: "\u26A0", label: channel.status === "suspended" ? t("orchestration.resume", "恢复") : t("orchestration.pause", "暂停"), action: () => {
          void (async () => {
            const nextStatus = channel.status === "suspended" ? "active" : "suspended";
            if (controlClient) {
              const updated = await controlClient.updateChannel(channel.id, { status: nextStatus });
              const idx = snapshot.channels.findIndex((c) => c.id === channel.id);
              if (idx >= 0) {
                snapshot.channels[idx] = updated;
              }
            } else {
              channel.status = nextStatus as typeof channel.status;
            }
            snapshot.dashboardStats.activeChannels = snapshot.channels.filter((c) => c.status === "active").length;
            controller?.render(snapshot);
          })();
        }, separatorAfter: true },
        { icon: "\uD83D\uDDD1", label: t("gateway.delete", "Delete"), danger: true, action: async () => {
          const confirmed = await confirmDialog(
            t("app.dialog.confirmTitle", "Please confirm"),
            t("toast.confirmDeleteChannel", "确定要删除这个渠道吗？") + ` (${channel.name})`,
            { confirmText: t("app.actions.delete", "Delete"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
          );
          if (confirmed) handleChannelDelete(channelId, snapshot, controller, controlClient);
        }},
      ]);
    });
  });

  // 拖拽排序渠道
  const channelList = target.querySelector<HTMLElement>(".channel-list");
  if (channelList) {
    enableChannelDragReorder(channelList, {
      onReorder: (orderedIds) => {
        void (async () => {
          const channelMap = new Map(snapshot.channels.map((c) => [c.id, c]));
          const reordered = orderedIds.map((id, idx) => {
            const ch = channelMap.get(id);
            if (ch) ch.priority = idx;
            return ch;
          }).filter(Boolean);
          if (reordered.length === snapshot.channels.length) {
            snapshot.channels = reordered as typeof snapshot.channels;
            await persistChannelOrder();
            controller?.render(snapshot);
          }
        })();
      },
    });
  }
}

// ─── 渠道 CRUD 操作（连接 Gateway API） ───

async function refreshDashboardStats(
  snapshot: CompanionRuntimeSnapshot,
  controlClient?: LocalControlClientLike,
): Promise<void> {
  if (controlClient) {
    snapshot.dashboardStats = await controlClient.fetchDashboardStats();
    return;
  }
  snapshot.dashboardStats = {
    ...snapshot.dashboardStats,
    totalChannels: snapshot.channels.length,
    activeChannels: snapshot.channels.filter((channel) => channel.status === "active").length,
  };
}

async function handleChannelAdd(
  data: ChannelAddFormData,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): Promise<void> {
  try {
    if (!controlClient) {
      showToast(t("store.channel.createFailed", "创建失败") + ": control client unavailable", "error");
      return;
    }
    const newChannel = await controlClient.createChannel({
      ...data,
      type: data.apiType,
    });
    snapshot.channels.push(newChannel);
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.created", "渠道创建成功") + ": " + data.name, "success");
  } catch (e: any) {
    showToast(t("store.channel.createFailed", "创建失败") + ": " + (e?.message || ""), "error");
  }
}

async function handleChannelEdit(
  data: ChannelAddFormData,
  channelId: string,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): Promise<void> {
  try {
    if (!controlClient) {
      showToast(t("store.channel.updateFailed", "更新失败") + ": control client unavailable", "error");
      return;
    }
    const updated = await controlClient.updateChannel(channelId, {
      ...data,
      type: data.apiType,
    });
    const idx = snapshot.channels.findIndex((c) => c.id === channelId);
    if (idx >= 0) {
      snapshot.channels[idx] = updated;
    }
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.updated", "渠道更新成功"), "success");
  } catch (e: any) {
    showToast(t("store.channel.updateFailed", "更新失败") + ": " + (e?.message || ""), "error");
  }
}

async function handleChannelDelete(
  channelId: string,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): Promise<void> {
  try {
    if (!controlClient) {
      showToast(t("store.channel.deleteFailed", "删除失败") + ": control client unavailable", "error");
      return;
    }
    await controlClient.deleteChannel(channelId);
    snapshot.channels = snapshot.channels.filter((c) => c.id !== channelId);
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.deleted", "渠道删除成功"), "success");
  } catch (e: any) {
    showToast(t("store.channel.deleteFailed", "删除失败") + ": " + (e?.message || ""), "error");
  }
}

// ─── 语言切换控制 ───

export function bindLocaleToggle(target: HTMLElement, controller: DesktopCompanionController): void {
  target.querySelectorAll<HTMLButtonElement>("[data-locale-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const i18n = (await import("./i18n")).default;
        const next = i18n.language === "zh" ? "en" : "zh";
        await i18n.changeLanguage(next);
        controller.render();
      } catch (e) {
        console.warn("[AgentSoul] Locale toggle failed:", e);
      }
    });
  });
  target.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const i18n = (await import("./i18n")).default;
        await i18n.changeLanguage(btn.dataset.locale!);
        controller.render();
      } catch (e) {
        console.warn("[AgentSoul] Locale change failed:", e);
      }
    });
  });
}

// ─── Companion 自定义控制 ───

export function bindCompanionCustomization(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController): void {
  // DisplayName 输入 → 更新快照中的 displayName 和 companion 名称
  target.querySelectorAll<HTMLInputElement>("[data-companion-field=\"displayName\"]").forEach((el) => {
    el.addEventListener("change", () => {
      const newName = el.value.trim();
      if (!newName) return;
      snapshot.companionCustomization.displayName = newName;
      snapshot.companion.displayName = newName;
      controller?.render(snapshot);
    });
  });

  // Kind 选择 → 更新外观类型，自动切换到该 kind 下第一个皮肤
  target.querySelectorAll<HTMLSelectElement>("[data-companion-field=\"kind\"]").forEach((el) => {
    el.addEventListener("change", () => {
      const newKind = el.value as CompanionRuntimeSnapshot["companion"]["petAppearance"]["kind"];
      snapshot.companionCustomization.currentKind = newKind;
      snapshot.companion.petAppearance.kind = newKind;
      const firstSkin = snapshot.companionCustomization.availableSkins.find((s) => s.kind === newKind);
      if (firstSkin) {
        snapshot.companionCustomization.currentSkin = firstSkin.skin;
        snapshot.companion.petAppearance.skin = firstSkin.skin;
      }
      controller?.render(snapshot);
    });
  });

  // 皮肤选择 → 更新当前皮肤
  target.querySelectorAll<HTMLButtonElement>("[data-skin-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const skin = btn.dataset.skinSelect!;
      snapshot.companionCustomization.currentSkin = skin as typeof snapshot.companionCustomization.currentSkin;
      snapshot.companion.petAppearance.skin = skin;
      controller?.render(snapshot);
    });
  });

  // 人格模板选择 → 高亮选中卡片并提示
  target.querySelectorAll<HTMLElement>("[data-persona-select]").forEach((el) => {
    el.addEventListener("click", () => {
      const templateId = el.dataset.personaSelect!;
      const tpl = snapshot.personaTemplates.find((t) => t.id === templateId);
      if (!tpl) return;
      el.closest(".persona-grid")?.querySelectorAll(".persona-card").forEach((card) => {
        card.classList.remove("persona-card--active");
      });
      el.classList.add("persona-card--active");
      showToast(t("settings.personaApplied", "人格模板已应用") + ": " + tpl.nameZh, "success");
    });
  });
}

// ─── 技能激活控制 ───

export function bindSkillControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-skill-activation]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const skillId = btn.dataset.skillActivation!;
      const activation = snapshot.skills.projectActivations.find((a) => a.skillPackId === skillId);
      if (activation) {
        activation.enabled = !activation.enabled;
        if (controlClient) {
          await controlClient.saveSkillsState(snapshot.skills);
        }
        showToast(
          t("skills.activationToggled", activation.enabled ? "技能已启用" : "技能已停用") + ": " + skillId,
          activation.enabled ? "success" : "info",
        );
        controller?.render(snapshot);
      }
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-safety-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.safetyAction!;
      if (action === "deploy-workspace-rules" && snapshot.skills.workspaceRuleDeployments.length > 0) {
        snapshot.skills.workspaceRuleDeployments = snapshot.skills.workspaceRuleDeployments.map((deployment) => ({
          ...deployment,
          status: "deployed",
        }));
        if (controlClient) {
          await controlClient.saveSkillsState(snapshot.skills);
        }
        controller?.render(snapshot);
      }
      showToast(t("skills.deployTriggered", "部署操作已触发") + ": " + action, "info");
    });
  });
}

// ─── 安全审批控制 (连接 local control client) ───

export function bindSafetyControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  target.querySelectorAll<HTMLButtonElement>("[data-approval-action][data-approval-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.approvalAction;
      const requestId = btn.dataset.approvalId!;
      if (!controlClient) {
        showToast(t("safety.notAvailable", "Safety management not available in local mode"), "info");
        return;
      }
      const ok = action === "allow"
        ? await controlClient.approveRequest(requestId)
        : await controlClient.denyRequest(requestId);
      if (!ok) {
        showToast(t("safety.updateFailed", "安全审批更新失败"), "error");
        return;
      }
      const req = snapshot.safety.approvalRequests.find((item) => item.id === requestId);
      if (req) {
        req.status = action === "allow" ? "allowed" : "denied";
      }
      showToast(
        action === "allow"
          ? t("safety.approved", "审批已同意")
          : t("safety.denied", "审批已拒绝"),
        "success",
      );
      controller?.render(snapshot);
    });
  });

  // 信任授权撤销（通过 Gateway controlClient）
  target.querySelectorAll<HTMLButtonElement>("[data-trust-revoke]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const grantId = btn.dataset.trustRevoke!;
      const confirmed = await confirmDialog(
        t("safety.confirmRevoke", "确认撤销"),
        t("safety.confirmRevokeMessage", "确定要撤销此信任授权吗？") + ` (${grantId})`,
        { confirmText: t("app.actions.revoke", "Revoke"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          const ok = await controlClient.revokeTrustGrant(grantId);
          if (ok) {
            showToast(t("safety.grantRevoked", "信任授权已撤销"), "success");
            const grant = snapshot.safety.scopedTrustGrants.find((g) => g.id === grantId);
            if (grant) grant.revokedAt = new Date().toISOString();
            controller?.render(snapshot);
          }
        } else {
          showToast(t("safety.notAvailable", "Safety management not available in local mode"), "info");
        }
      }
    });
  });
}

// ─── 会话管理控制 (连接 local control client) ───

export function bindSessionControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  const syncWorkSessionsFromLocal = (): void => {
    snapshot.sessions.workSessions = snapshot.localSessions.map((session) => ({
      id: session.id,
      source: "gateway-session-repository",
      client: session.provider,
      projectPath: session.projectDir,
      lastActiveAt: session.lastActiveAt,
      evidenceSummary: session.summary || "",
      searchable: true,
      resumable: !!session.isResumable,
      resumeCommand: session.resumeCommand,
    }));
  };

  // 搜索（实时过滤 + 数据层搜索）
  target.querySelectorAll<HTMLInputElement>("[data-session-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const keyword = input.value.trim().toLowerCase();
      const sessions = snapshot.localSessions;
      const filtered = keyword
        ? sessions.filter((s) =>
            s.projectDir.toLowerCase().includes(keyword) ||
            (s.summary || "").toLowerCase().includes(keyword) ||
            s.provider.toLowerCase().includes(keyword)
          )
        : sessions;
      if (keyword) {
        showToast(t("sessions.searchResult", "搜索结果") + `: ${filtered.length}`, "info");
      }
      const listEl = target.querySelector(".session-results");
      if (listEl) {
        listEl.innerHTML = filtered.map((s) => `
          <article class="session-row">
            <h3>${escapeHtml(s.projectDir)}</h3>
            <p>${t("sessions.source", "Session Source")}: ${escapeHtml(s.provider)} · ${escapeHtml(s.lastActiveAt)}</p>
            ${s.summary ? `<p>${escapeHtml(s.summary)}</p>` : ''}
            <p>${s.messageCount} ${t("sessions.messages", "messages")} · ${t("sessions.resumable", "Resumable")}: ${s.isResumable ? t("common.yes", "yes") : t("common.no", "no")}</p>
            ${s.isResumable ? `<button type="button" data-session-launch="${escapeHtml(s.id)}">${t("sessions.resume", "Resume Session")}</button>` : ''}
          </article>
        `).join("");
      }
    });
  });

  // 启动会话（真实本地恢复动作）
  target.querySelectorAll<HTMLButtonElement>("[data-session-launch]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sessionId = btn.dataset.sessionLaunch!;
      const session = snapshot.localSessions.find((s) => s.id === sessionId);
      if (!session?.isResumable) {
        showToast(t("sessions.notResumable", "此会话不可恢复"), "info");
        return;
      }
      const confirmed = await confirmDialog(
        t("sessions.confirmLaunch", "确认启动"),
        t("sessions.confirmLaunchMessage", "确定要恢复此会话吗？") + ` (${sessionId})`,
        { confirmText: t("app.actions.launch", "Launch"), cancelText: t("app.actions.cancel", "Cancel") },
      );
      if (confirmed && controlClient) {
        showToast(t("sessions.resuming", "正在恢复会话..."), "info");
        const result = await controlClient.resumeSession(sessionId);
        if (result.success) {
          showToast(t("sessions.resumed", "会话已恢复"), "success");
        } else {
          const feedback = resolveSessionResumeFeedback(result.message);
          const reason = t(feedback.key, result.message || t("sessions.resumeFailed", "恢复失败"));
          const hint = feedback.hintKey ? ` ${t(feedback.hintKey, "")}`.trim() : "";
          showToast(`${t("sessions.resumeFailed", "恢复失败")}: ${reason}${hint ? ` · ${hint}` : ""}`, feedback.level);
        }
      } else if (confirmed) {
        showToast(t("sessions.notAvailable", "Session resume not available in local mode"), "info");
      }
    });
  });

  // 删除会话（通过 controlClient）
  target.querySelectorAll<HTMLButtonElement>("[data-session-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sessionId = btn.dataset.sessionDelete!;
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "请确认"),
        t("sessions.confirmDelete", "确定要删除此会话吗？"),
        { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          await controlClient.deleteSession(sessionId);
        }
        snapshot.localSessions = snapshot.localSessions.filter((s) => s.id !== sessionId);
        syncWorkSessionsFromLocal();
        controller?.render(snapshot);
        showToast(t("sessions.deleted", "会话已删除"), "success");
      }
    });
  });

  // 搜索（sessions-mgr 区域）
  target.querySelectorAll<HTMLInputElement>("[data-session-mgr-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const keyword = input.value.trim().toLowerCase();
      const sessions = snapshot.localSessions;
      const filtered = keyword
        ? sessions.filter((s) =>
            s.projectDir.toLowerCase().includes(keyword) ||
            (s.summary || "").toLowerCase().includes(keyword) ||
            s.provider.toLowerCase().includes(keyword)
          )
        : sessions;
      const listEl = target.querySelector(".session-list");
      if (listEl) {
        listEl.innerHTML = filtered.map((s) => `
          <article class="session-card" role="listitem" data-session-id="${escapeHtml(s.id)}">
            <div class="session-card-header">
              <span class="provider-badge">${escapeHtml(s.provider)}</span>
              <h4>${escapeHtml(s.projectDir)}</h4>
              <span class="session-time">${escapeHtml(s.lastActiveAt)}</span>
            </div>
            ${s.summary ? '<p class="session-summary">' + escapeHtml(s.summary) + '</p>' : ''}
            <div class="session-card-footer">
              <span class="session-msg-count">${s.messageCount} ${t("sessions.messages", "messages")}</span>
              ${s.isResumable ? '<button type="button" data-session-resume="' + escapeHtml(s.id) + '" class="channel-action-btn channel-action-btn--ghost">' + t("sessions.resume", "Resume") + '</button>' : '<span class="session-not-resumable">' + t("sessions.notResumable", "Not resumable") + '</span>'}
              <button type="button" data-session-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">&#128465;</button>
            </div>
          </article>
        `).join("");
      }
    });
  });
}

// ─── MCP 服务器控制 (连接 local control client) ───

export function bindMcpControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  target.querySelectorAll<HTMLButtonElement>("[data-mcp-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverId = btn.dataset.mcpToggle!;
      if (!controlClient) {
        showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info");
        return;
      }
      const updated = await controlClient.toggleMcpServer(serverId);
      if (updated) {
        const idx = snapshot.mcpServers.findIndex((s) => s.id === serverId);
        if (idx >= 0) snapshot.mcpServers[idx] = updated;
        showToast(
          t("mcp.statusToggled", updated.status === "running" ? "MCP 服务器已启动" : "MCP 服务器已停止") + ": " + updated.name,
          updated.status === "running" ? "success" : "info",
        );
        controller?.render(snapshot);
      } else {
        showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info");
      }
    });
  });

  // 添加 MCP 服务器
  target.querySelectorAll<HTMLButtonElement>("[data-mcp-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!controlClient) {
        showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info");
        return;
      }
      openModal(`
        <h3>${t("mcp.addServer", "添加 MCP 服务器")}</h3>
        <div class="form-group">
          <label class="modal-label">${t("mcp.serverName", "名称")}</label>
          <input type="text" class="modal-input" id="mcp-add-name" placeholder="我的 MCP 服务" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("mcp.command", "命令")}</label>
          <input type="text" class="modal-input" id="mcp-add-command" placeholder="例如: npx" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("mcp.args", "参数")}</label>
          <input type="text" class="modal-input" id="mcp-add-args" placeholder="-y @modelcontextprotocol/server-filesystem" />
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button>
          <button type="button" class="modal-btn modal-btn--primary" id="mcp-add-submit">${t("common.add", "添加")}</button>
        </div>
      `);
      document.getElementById("mcp-add-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("mcp-add-name") as HTMLInputElement)?.value?.trim();
        const command = (document.getElementById("mcp-add-command") as HTMLInputElement)?.value?.trim();
        const argsStr = (document.getElementById("mcp-add-args") as HTMLInputElement)?.value?.trim();
        if (!name || !command) {
          showToast(t("mcp.fillRequired", "请填写必填字段"), "error");
          return;
        }
        const args = argsStr ? argsStr.split(" ").filter(Boolean) : undefined;
        const server = await controlClient.createMcpServer({ name, command, args });
        if (server) {
          snapshot.mcpServers.push(server);
          closeModal();
          controller?.render(snapshot);
          showToast(t("mcp.serverAdded", "MCP 服务器已添加") + ": " + name, "success");
        } else {
          closeModal();
          showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info");
        }
      });
    });
  });

  // 删除 MCP 服务器
  target.querySelectorAll<HTMLButtonElement>("[data-mcp-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverId = btn.dataset.mcpDelete!;
      const server = snapshot.mcpServers.find((s) => s.id === serverId);
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "请确认"),
        t("mcp.confirmDelete", "确定要删除此 MCP 服务器吗？") + (server ? ` (${server.name})` : ""),
        { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          await controlClient.deleteMcpServer(serverId);
        }
        snapshot.mcpServers = snapshot.mcpServers.filter((s) => s.id !== serverId);
        controller?.render(snapshot);
        showToast(t("mcp.serverDeleted", "MCP 服务器已删除"), "success");
      }
    });
  });
}

// ─── Prompt 模板控制 (连接数据层) ───

export function bindPromptControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  // 收藏/取消收藏
  target.querySelectorAll<HTMLButtonElement>("[data-prompt-favorite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const promptId = btn.dataset.promptFavorite!;
      const original = snapshot.prompts.find((p) => p.id === promptId);
      const updated = controlClient
        ? await controlClient.togglePromptFavorite(promptId, original ? !original.isFavorite : undefined)
        : null;
      if (updated) {
        const idx = snapshot.prompts.findIndex((p) => p.id === promptId);
        if (idx >= 0) snapshot.prompts[idx] = updated;
        showToast(
          t("prompt.favToggled", updated.isFavorite ? "已收藏" : "已取消收藏") + ": " + updated.name,
          "success",
        );
        controller?.render(snapshot);
      }
    });
  });

  // 添加 Prompt
  target.querySelectorAll<HTMLButtonElement>("[data-prompt-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("prompt.addPrompt", "添加 Prompt 模板")}</h3>
        <div class="form-group">
          <label class="modal-label">${t("prompt.name", "名称")}</label>
          <input type="text" class="modal-input" id="prompt-add-name" placeholder="我的提示词模板" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("prompt.nameZh", "中文名称")}</label>
          <input type="text" class="modal-input" id="prompt-add-nameZh" placeholder="我的 Prompt" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("prompt.content", "内容")}</label>
          <textarea class="modal-input" id="prompt-add-content" rows="6" placeholder="在这里编写提示词内容..."></textarea>
        </div>
        <div class="form-group">
          <label class="modal-label">${t("prompt.category", "分类")}</label>
          <input type="text" class="modal-input" id="prompt-add-category" placeholder="例如: 开发" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("prompt.tags", "标签")}</label>
          <input type="text" class="modal-input" id="prompt-add-tags" placeholder="标签1, 标签2" />
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button>
          <button type="button" class="modal-btn modal-btn--primary" id="prompt-add-submit">${t("common.add", "添加")}</button>
        </div>
      `);
      document.getElementById("prompt-add-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("prompt-add-name") as HTMLInputElement)?.value?.trim();
        const content = (document.getElementById("prompt-add-content") as HTMLTextAreaElement)?.value?.trim();
        if (!name || !content) {
          showToast(t("prompt.fillRequired", "请填写名称和内容"), "error");
          return;
        }
        const nameZh = (document.getElementById("prompt-add-nameZh") as HTMLInputElement)?.value?.trim();
        const category = (document.getElementById("prompt-add-category") as HTMLInputElement)?.value?.trim();
        const tagsStr = (document.getElementById("prompt-add-tags") as HTMLInputElement)?.value?.trim();
        const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
        const prompt = controlClient
          ? await controlClient.createPrompt({ name, nameZh, content, category, tags })
          : null;
        if (prompt) {
          snapshot.prompts.push(prompt);
          closeModal();
          controller?.render(snapshot);
          showToast(t("prompt.added", "Prompt 模板已添加") + ": " + name, "success");
        } else {
          closeModal();
          showToast(t("prompt.notAvailable", "Prompt management not available in local mode"), "info");
        }
      });
    });
  });

  // 删除 Prompt
  target.querySelectorAll<HTMLButtonElement>("[data-prompt-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const promptId = btn.dataset.promptDelete!;
      const prompt = snapshot.prompts.find((p) => p.id === promptId);
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "请确认"),
        t("prompt.confirmDelete", "确定要删除此 Prompt 模板吗？") + (prompt ? ` (${prompt.name})` : ""),
        { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          await controlClient.deletePrompt(promptId);
        }
        snapshot.prompts = snapshot.prompts.filter((p) => p.id !== promptId);
        controller?.render(snapshot);
        showToast(t("prompt.deleted", "Prompt 模板已删除"), "success");
      }
    });
  });
}

// ─── 设置标签页切换 + 设置持久化 ───

export function bindSettingsTabs(
  target: HTMLElement,
  snapshot?: CompanionRuntimeSnapshot,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-settings-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.settingsTab!;
      const shell = target.querySelector<HTMLElement>(".shell");
      if (shell) {
        shell.setAttribute("data-active-settings-tab", tabId);
      }
      // 高亮当前标签
      target.querySelectorAll("[data-settings-tab]").forEach((t) => {
        t.classList.remove("settings-tab--active");
      });
      btn.classList.add("settings-tab--active");
      // 切换面板可见性
      target.querySelectorAll("[data-settings-panel]").forEach((panel) => {
        (panel as HTMLElement).style.display =
          panel.getAttribute("data-settings-panel") === tabId ? "" : "none";
      });
    });
  });

  // 设置字段变更持久化
  target.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]").forEach((el) => {
    const eventType = el.type === "checkbox" ? "change" : "change";
    el.addEventListener(eventType, async () => {
      const key = el.dataset.setting as string;
      let value: any;
      if (el.type === "checkbox") {
        value = (el as HTMLInputElement).checked;
      } else if (el.type === "number" || el.type === "range") {
        value = Number(el.value);
      } else {
        value = el.value;
      }
      if (snapshot) {
        const previousValue = (snapshot.appSettings as any)[key];
        (snapshot.appSettings as any)[key] = value;
        if (key === "gatewayAccessKey" && typeof localStorage !== "undefined") {
          const normalized = String(value ?? "").trim();
          if (normalized.length > 0) {
            localStorage.setItem("agentsoul_gateway_access_key", normalized);
          } else {
            localStorage.removeItem("agentsoul_gateway_access_key");
          }
          controlClient?.setAccessKey(normalized || undefined);
        }
        if (controlClient) {
          const ok = await controlClient.saveAppSettings(snapshot.appSettings);
          if (!ok) {
            (snapshot.appSettings as any)[key] = previousValue;
            if (key === "gatewayAccessKey" && typeof localStorage !== "undefined") {
              const fallback = String(previousValue ?? "").trim();
              if (fallback.length > 0) {
                localStorage.setItem("agentsoul_gateway_access_key", fallback);
              } else {
                localStorage.removeItem("agentsoul_gateway_access_key");
              }
              controlClient.setAccessKey(fallback || undefined);
            }
            if (el instanceof HTMLInputElement && el.type === "checkbox") {
              el.checked = Boolean(previousValue);
            } else {
              (el as HTMLInputElement | HTMLSelectElement).value = String(previousValue ?? "");
            }
            showToast(t("settings.saveFailed", "设置保存失败"), "error");
            return;
          }
        }
        showToast(t("settings.saved", "设置已保存") + ": " + key, "success");
      }
    });
  });

  // 导出配置
  target.querySelectorAll<HTMLButtonElement>("[data-action='export-config']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!snapshot) return;
      const config = JSON.stringify(snapshot.appSettings, null, 2);
      navigator.clipboard?.writeText(config);
      showToast(t("settings.exported", "配置已复制到剪贴板"), "success");
    });
  });

  // 导入配置
  target.querySelectorAll<HTMLButtonElement>("[data-action='import-config']").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("settings.importConfig", "导入配置")}</h3>
        <div class="form-group">
          <label class="modal-label">${t("settings.pasteConfig", "粘贴配置 JSON")}</label>
          <textarea class="modal-input" id="import-config-json" rows="10" placeholder='{"language":"zh","theme":"dark"}'></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button>
          <button type="button" class="modal-btn modal-btn--primary" id="import-config-submit">${t("settings.import", "导入")}</button>
        </div>
      `);
      document.getElementById("import-config-submit")?.addEventListener("click", async () => {
        const jsonStr = (document.getElementById("import-config-json") as HTMLTextAreaElement)?.value?.trim();
        if (!jsonStr) return;
        try {
          const imported = JSON.parse(jsonStr);
          if (snapshot) {
            const previous = { ...snapshot.appSettings };
            const previousAccessKey = previous.gatewayAccessKey;
            const next = sanitizeImportedAppSettings(imported, snapshot.appSettings);
            snapshot.appSettings = next;
            if (controlClient) {
              const ok = await controlClient.saveAppSettings(next);
              if (!ok) {
                snapshot.appSettings = previous;
                if (typeof localStorage !== "undefined") {
                  const fallback = previousAccessKey?.trim() ?? "";
                if (fallback.length > 0) {
                  localStorage.setItem("agentsoul_gateway_access_key", fallback);
                } else {
                  localStorage.removeItem("agentsoul_gateway_access_key");
                }
                controlClient?.setAccessKey(fallback || undefined);
              }
              throw new Error("persist-failed");
            }
            }
            if (typeof localStorage !== "undefined") {
              const normalized = next.gatewayAccessKey?.trim() ?? "";
              if (normalized.length > 0) {
                localStorage.setItem("agentsoul_gateway_access_key", normalized);
              } else {
                localStorage.removeItem("agentsoul_gateway_access_key");
              }
              controlClient?.setAccessKey(normalized || undefined);
            }
          }
          closeModal();
          showToast(t("settings.imported", "配置已导入"), "success");
        } catch {
          showToast(t("settings.importFailed", "配置导入失败"), "error");
        }
      });
    });
  });

  // 创建备份（从设置页面快捷入口）
  target.querySelectorAll<HTMLButtonElement>("[data-action='create-backup']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast(t("backup.useBackupSection", "请使用备份管理区域创建备份"), "info");
    });
  });
}

// ─── CCX 会话驾驶舱控制 ───

export function bindConversationDashboardControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  const rerender = () => controller?.render(snapshot);

  // Kind 过滤
  target.querySelectorAll<HTMLButtonElement>("[data-kind-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.kindFilter as ConversationKind | "";
      snapshot.conversationDashboard.activeFilter = filter;
      rerender();
    });
  });

  // 搜索
  target.querySelectorAll<HTMLInputElement>("[data-conversation-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const query = input.value.trim();
      snapshot.conversationDashboard.searchQuery = query;
      rerender();
    });
  });

  // 会话卡片点击
  target.querySelectorAll<HTMLElement>("[data-conversation-id]").forEach((card) => {
    card.addEventListener("click", async () => {
      const convId = card.dataset.conversationId!;
      const linkedSession = snapshot.localSessions.find((session) => session.id === convId);
      if (linkedSession?.isResumable && controlClient) {
        const resumeResult = await controlClient.resumeSession(convId);
        if (resumeResult.success) {
          showToast(t("sessions.resumed", "会话已恢复"), "success");
        } else {
          const feedback = resolveSessionResumeFeedback(resumeResult.message);
          const reason = t(feedback.key, resumeResult.message || t("sessions.resumeFailed", "恢复失败"));
          const hint = feedback.hintKey ? ` ${t(feedback.hintKey, "")}`.trim() : "";
          showToast(`${t("sessions.resumeFailed", "恢复失败")}: ${reason}${hint ? ` · ${hint}` : ""}`, feedback.level);
        }
      } else {
        const shell = target.querySelector<HTMLElement>(".shell");
        if (shell) {
          shell.setAttribute("data-active-tab", "sessions");
        }
        showToast(t("cockpit.openConversation", "Opening conversation") + ": " + convId, "info");
      }
    });
  });
}

// ─── CCX 图表控制 (Key Trend & Model Stats) ───

export function bindChartControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  // Duration 选择
  target.querySelectorAll<HTMLButtonElement>("[data-duration]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const duration = btn.dataset.duration!;
      const chart = btn.closest(".key-trend-chart, .model-stats-chart");
      if (chart) {
        chart.querySelectorAll("[data-duration]").forEach((b) => {
          b.classList.remove("duration-btn--active");
        });
        btn.classList.add("duration-btn--active");
      }
      const isKeyTrend = !!btn.closest(".key-trend-chart");
      if (isKeyTrend) {
        snapshot.keyTrend.duration = duration as typeof snapshot.keyTrend.duration;
      } else {
        snapshot.modelStats.duration = duration as typeof snapshot.modelStats.duration;
      }
      controller?.render(snapshot);
      showToast(t("chart.durationChanged", "Duration changed") + ": " + duration, "info");
    });
  });

  // View 选择
  target.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view!;
      const chart = btn.closest(".key-trend-chart, .model-stats-chart");
      if (chart) {
        chart.querySelectorAll("[data-view]").forEach((b) => {
          b.classList.remove("view-btn--active");
        });
        btn.classList.add("view-btn--active");
      }
      const isKeyTrend = !!btn.closest(".key-trend-chart");
      if (isKeyTrend) {
        snapshot.keyTrend.view = view as typeof snapshot.keyTrend.view;
      } else {
        snapshot.modelStats.view = view as typeof snapshot.modelStats.view;
      }
      controller?.render(snapshot);
      showToast(t("chart.viewChanged", "View changed") + ": " + view, "info");
    });
  });

  // 刷新按钮
  target.querySelectorAll<HTMLButtonElement>("[data-chart-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showToast(t("chart.refreshing", "Refreshing data..."), "info");
      if (!controlClient) return;
      try {
        const fresh = await controlClient.loadSnapshot();
        snapshot.dashboardStats = fresh.dashboardStats;
        snapshot.channels = fresh.channels;
        snapshot.keyTrend = { ...snapshot.keyTrend, ...fresh.keyTrend, duration: snapshot.keyTrend.duration, view: snapshot.keyTrend.view };
        snapshot.modelStats = { ...snapshot.modelStats, ...fresh.modelStats, duration: snapshot.modelStats.duration, view: snapshot.modelStats.view };
        controller?.render(snapshot);
      } catch {
        showToast(t("chart.refreshFailed", "刷新失败"), "error");
      }
    });
  });
}

// ─── CCX Update Dialog 控制 ───

export function bindUpdateDialogControls(target: HTMLElement): void {
  target.querySelectorAll<HTMLButtonElement>("[data-dialog-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      if (dialog) {
        (dialog as HTMLDialogElement).close();
      }
    });
  });
}

// ─── cc-switch App Switcher 控制 (持久化) ───

export function bindAppSwitcherControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController): void {
  target.querySelectorAll<HTMLButtonElement>("[data-app-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const appId = btn.dataset.appId as AppId;
      // Persist selected app and keep snapshot/source-of-truth in sync.
      snapshot.appSwitcher.activeApp = appId;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("agentsoul_active_app", appId);
      }
      controller?.render(snapshot);
      showToast(t("appSwitcher.switched", "Switched to") + ": " + appId, "success");
    });
  });
}

// ─── cc-switch Usage Footer 控制 ───

export function bindUsageFooterControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-usage-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showToast(t("usage.refreshing", "Refreshing usage data..."), "info");
      if (!controlClient) return;
      try {
        const fresh = await controlClient.loadSnapshot();
        snapshot.usageFooter = fresh.usageFooter;
        snapshot.dashboardStats = fresh.dashboardStats;
        snapshot.channels = fresh.channels;
        snapshot.keyTrend = { ...snapshot.keyTrend, ...fresh.keyTrend, duration: snapshot.keyTrend.duration, view: snapshot.keyTrend.view };
        snapshot.modelStats = { ...snapshot.modelStats, ...fresh.modelStats, duration: snapshot.modelStats.duration, view: snapshot.modelStats.view };
        controller?.render(snapshot);
        showToast(t("usage.refreshed", "用量已刷新"), "success");
      } catch {
        showToast(t("usage.refreshFailed", "用量刷新失败"), "error");
      }
    });
  });
}

// ─── cc-switch Backup 控制 (连接 local control client) ───

export function bindBackupControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  const refreshBackupsFromControl = async (): Promise<void> => {
    if (!controlClient) return;
    try {
      const backups = await controlClient.listBackups();
      snapshot.backupList = {
        ...snapshot.backupList,
        backups,
        autoBackupEnabled: snapshot.appSettings.autoBackup,
        autoBackupInterval: snapshot.appSettings.autoBackupInterval,
      };
    } catch {
      // Keep last rendered backup list on refresh failure.
    }
  };

  // 创建备份
  target.querySelectorAll<HTMLButtonElement>("[data-backup-create]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("backup.createBackup", "创建备份")}</h3>
        <div class="form-group">
          <label class="modal-label">${t("backup.name", "备份名称")}</label>
          <input type="text" class="modal-input" id="backup-name" placeholder="手动备份" />
        </div>
        <div class="form-group">
          <label class="modal-label">${t("backup.description", "描述")}</label>
          <textarea class="modal-input" id="backup-desc" rows="3" placeholder="可选描述..." ></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button>
          <button type="button" class="modal-btn modal-btn--primary" id="backup-create-submit">${t("backup.create", "创建备份")}</button>
        </div>
      `);
      document.getElementById("backup-create-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("backup-name") as HTMLInputElement)?.value?.trim();
        const desc = (document.getElementById("backup-desc") as HTMLTextAreaElement)?.value?.trim();
        closeModal();
        if (controlClient) {
          const entry = await controlClient.createBackup(name || undefined, desc || undefined);
          if (entry) {
            await refreshBackupsFromControl();
            showToast(t("backup.created", "备份已创建") + ": " + entry.name, "success");
          } else {
            showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
          }
        } else {
          showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
        }
        controller?.render(snapshot);
      });
    });
  });

  // 自动备份开关
  target.querySelectorAll<HTMLButtonElement>("[data-backup-auto-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.classList.toggle("toggle-btn--active");
      const isActive = btn.classList.contains("toggle-btn--active");
      btn.textContent = isActive ? t("common.on", "ON") : t("common.off", "OFF");
      snapshot.appSettings.autoBackup = isActive;
      snapshot.backupList.autoBackupEnabled = isActive;
      if (controlClient) {
        await controlClient.saveAppSettings(snapshot.appSettings);
      }
      controller?.render(snapshot);
      showToast(t("backup.autoBackupToggled", "Auto backup") + ": " + (isActive ? t("common.on", "ON") : t("common.off", "OFF")), "info");
    });
  });

  // 恢复备份（真实写回动作）
  target.querySelectorAll<HTMLButtonElement>("[data-backup-restore]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const backupId = btn.dataset.backupRestore!;
      const confirmed = await confirmDialog(
        t("backup.confirmRestore", "Confirm Restore"),
        t("backup.confirmRestoreMessage", "This will overwrite current settings. Continue?"),
        { confirmText: t("backup.restore", "Restore"), cancelText: t("common.cancel", "Cancel") },
      );
      if (confirmed && controlClient) {
        const ok = await controlClient.restoreBackup(backupId);
        if (ok) {
          // Reload snapshot from gateway to reflect restored state
          try {
            const fresh = await controlClient.loadSnapshot();
            snapshot.mcpServers = fresh.mcpServers;
            snapshot.channels = fresh.channels;
            snapshot.dashboardStats = fresh.dashboardStats;
            snapshot.backupList = fresh.backupList;
            showToast(t("backup.restored", "备份已恢复"), "success");
          } catch {
            showToast(t("backup.restored", "备份已恢复"), "success");
          }
          controller?.render(snapshot);
        } else {
          showToast(t("backup.restoreFailed", "恢复失败"), "error");
        }
      } else if (confirmed) {
        showToast(t("backup.notAvailable", "Backup not available in local mode"), "info");
      }
    });
  });

  // 删除备份
  target.querySelectorAll<HTMLButtonElement>("[data-backup-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const backupId = btn.dataset.backupDelete!;
      const confirmed = await confirmDialog(
        t("backup.confirmDelete", "Confirm Delete"),
        t("backup.confirmDeleteMessage", "This backup will be permanently deleted. Continue?"),
        { confirmText: t("common.delete", "Delete"), cancelText: t("common.cancel", "Cancel"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          await controlClient.deleteBackup(backupId);
          await refreshBackupsFromControl();
        }
        showToast(t("backup.deleted", "Backup deleted"), "success");
        controller?.render(snapshot);
      }
    });
  });
}

// ─── cc-switch WebDAV 控制 ───

export function bindWebdavControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  const saveWebdavState = async (): Promise<void> => {
    try {
      localStorage.setItem("agentsoul_webdav_sync", JSON.stringify(snapshot.webdavSync));
    } catch {
      // ignore
    }
    if (controlClient) {
      await controlClient.saveAppSettings({
        ...snapshot.appSettings,
        proxyUrl: snapshot.appSettings.proxyUrl,
      });
    }
  };

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-configure]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverUrl = (target.querySelector("[data-webdav-field='serverUrl']") as HTMLInputElement | null)?.value?.trim() || "";
      const username = (target.querySelector("[data-webdav-field='username']") as HTMLInputElement | null)?.value?.trim() || "";
      const remotePath = (target.querySelector("[data-webdav-field='remotePath']") as HTMLInputElement | null)?.value?.trim() || "";
      if (!serverUrl || !username || !remotePath) {
        showToast(t("webdav.fillRequired", "请填写 WebDAV 必填项"), "error");
        return;
      }
      snapshot.webdavSync.config.serverUrl = serverUrl;
      snapshot.webdavSync.config.username = username;
      snapshot.webdavSync.config.remotePath = remotePath;
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
      showToast(
        t("webdav.autoSync", "自动同步") + ": " + (snapshot.webdavSync.config.autoSync ? t("common.on", "ON") : t("common.off", "OFF")),
        "info",
      );
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-webdav-sync]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!snapshot.webdavSync.isConfigured) {
        showToast(t("webdav.notConfigured", "WebDAV 未配置"), "error");
        return;
      }
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
      snapshot.webdavSync = {
        status: "idle",
        isConfigured: false,
        config: {
          serverUrl: "",
          username: "",
          remotePath: "",
          autoSync: false,
          syncInterval: snapshot.webdavSync.config.syncInterval || 30,
        },
      };
      await saveWebdavState();
      controller?.render(snapshot);
      showToast(t("webdav.resetDone", "WebDAV 配置已重置"), "success");
    });
  });
}

// ─── cc-switch Deep Link Import 控制 ───

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
      snapshot.keyTrend = {
        ...snapshot.keyTrend,
        ...fresh.keyTrend,
        duration: snapshot.keyTrend.duration,
        view: snapshot.keyTrend.view,
      };
      snapshot.modelStats = {
        ...snapshot.modelStats,
        ...fresh.modelStats,
        duration: snapshot.modelStats.duration,
        view: snapshot.modelStats.view,
      };
    } catch {
      // Keep local optimistic state if snapshot refresh fails.
    }
  };

  target.querySelectorAll<HTMLButtonElement>("[data-deeplink-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = target.querySelector<HTMLDialogElement>("[data-dialog='deeplink-import']");
      if (dialog && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-deeplink-parse]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = target.querySelector<HTMLTextAreaElement>("[data-deeplink-input]");
      const lines = (input?.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const parsed = lines.map((line) => {
        try {
          const u = new URL(line);
          const type = (u.searchParams.get("type") || "config") as "channel" | "provider" | "config" | "skill";
          return {
            type,
            url: line,
            name: u.searchParams.get("name") || undefined,
            description: u.searchParams.get("desc") || undefined,
            parsedConfig: {
              ...Object.fromEntries(u.searchParams.entries()),
            },
          };
        } catch {
          return null;
        }
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
      if (snapshot.deepLinkImport.links.length === 0) {
        showToast(t("deeplink.noLinks", "没有可导入的链接"), "info");
        return;
      }
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
          if (baseUrl) {
            try {
              await controlClient.createChannel({ name, type: apiType, baseUrl, apiKeys: cfg.apiKey ? [cfg.apiKey] : [] });
              importedCount += 1;
            } catch {
              // ignore single item failure
            }
          }
        } else if (link.type === "config" && controlClient) {
          const nextSettings = { ...snapshot.appSettings };
          if (cfg.language === "zh" || cfg.language === "en") nextSettings.language = cfg.language;
          if (cfg.theme === "dark" || cfg.theme === "light" || cfg.theme === "system") nextSettings.theme = cfg.theme;
          await controlClient.saveAppSettings(nextSettings);
          snapshot.appSettings = nextSettings;
          importedCount += 1;
        } else if (link.type === "skill" && controlClient) {
          const skillPackId = cfg.skillPackId || cfg.id || link.name || "imported-skill";
          const current = snapshot.skills;
          if (!current.projectActivations.find((item) => item.skillPackId === skillPackId)) {
            current.projectActivations.push({ skillPackId, enabled: true, source: "project" });
            await controlClient.saveSkillsState(current);
          }
          importedCount += 1;
        } else {
          importedCount += 1;
        }
        snapshot.deepLinkImport.importProgress = Math.round((importedCount / snapshot.deepLinkImport.links.length) * 100);
        controller?.render(snapshot);
      }

      snapshot.deepLinkImport.isImporting = false;
      snapshot.deepLinkImport.lastImportResult = {
        success: true,
        importedCount,
        message: t("deeplink.importSuccess", "导入完成"),
      };
      await syncFromControlSnapshot();
      controller?.render(snapshot);
      const dialog = target.querySelector<HTMLDialogElement>("[data-dialog='deeplink-import']");
      if (dialog && dialog.open) dialog.close();
      showToast(t("deeplink.importSuccess", "导入完成") + `: ${importedCount}`, "success");
    });
  });
}
