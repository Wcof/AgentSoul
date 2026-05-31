/**
 * Companion Area — bind functions
 * Binds event listeners for companion interactions, customization,
 * and the desktop pet widget.
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, CompanionInteractionKind } from "../../types";
import { t, resolveVisualState, errorMessage } from "../../shared/utils";
import { openContextMenu } from "../../utils/contextMenu";
import { showToast } from "../../utils/modal";
import { tauriInvoke } from "../../utils/tauriIpc";

export function bindCompanionArea(ctx: AreaContext): void {
  bindInteractionControls(ctx.target, ctx.controller);
  bindCompanionCustomization(ctx.target, ctx.snapshot, ctx.controller);
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

export function bindCompanionCustomization(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
): void {
  // DisplayName input
  target.querySelectorAll<HTMLInputElement>("[data-companion-field=\"displayName\"]").forEach((el) => {
    el.addEventListener("change", () => {
      const newName = el.value.trim();
      if (!newName) return;
      snapshot.companionCustomization.displayName = newName;
      snapshot.companion.displayName = newName;
      controller?.render(snapshot);
    });
  });

  // Kind select
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

  // Skin select
  target.querySelectorAll<HTMLButtonElement>("[data-skin-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const skin = btn.dataset.skinSelect!;
      snapshot.companionCustomization.currentSkin = skin as typeof snapshot.companionCustomization.currentSkin;
      snapshot.companion.petAppearance.skin = skin;
      controller?.render(snapshot);
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-companion-pick-pack]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const picked = await pickPetAssetPackFolderPath();
      if (!picked) return;
      const pathInput = target.querySelector<HTMLInputElement>("[data-companion-asset-pack-path]");
      if (pathInput) pathInput.value = picked;
      showToast(t("companion.assetPackPicked", "已选择形象资源包"), "info");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-companion-apply-pack]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pathInput = target.querySelector<HTMLInputElement>("[data-companion-asset-pack-path]");
      const selectedPath = pathInput?.value?.trim();
      if (!selectedPath) {
        showToast(t("companion.assetPackPathRequired", "请先选择形象资源包文件夹"), "error");
        return;
      }
      const next = await importAndApplyPetAssetPack(snapshot, selectedPath);
      if (next) {
        controller?.render(next, t("companion.assetPackImported", "形象已导入并切换"));
      }
    });
  });
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
      action: () => { void controller.performInteraction("pet"); },
    },
    {
      icon: "🔄",
      label: t("common.refreshRuntime", "刷新运行时"),
      action: () => { window.location.reload(); },
    },
    {
      icon: "📊",
      label: t("common.showStatus", "显示状态"),
      action: () => {
        const snapshot = getSnapshot?.();
        if (!snapshot) return;
        const summary = snapshot.companion.summary ?? "status unavailable";
        showToast(summary, "info");
      },
    },
    {
      icon: "🧭",
      label: t("common.openControlCenter", "打开控制中心"),
      action: () => { void openControlCenterWindow(); },
    },
    {
      icon: "🙈",
      label: t("common.hideCompanion", "隐藏伴侣"),
      action: () => { void hideDesktopCompanionWindow(); },
    },
    {
      icon: "📦",
      label: t("companion.applyAssetPack", "更换形象"),
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
  const pickedPath = await pickPetAssetPackFolderPath();
  if (!pickedPath) return;
  const next = await importAndApplyPetAssetPack(current, pickedPath);
  if (!next) return;
  const messages = next.companion.petAppearance.assetValidation?.messages ?? [];
  const statusPrefix = next.companion.petAppearance.assetValidation?.level === "error" ? "Asset pack load failed" : "Asset pack loaded";
  const status = messages.length > 0 ? `${statusPrefix}: ${messages[0]}` : statusPrefix;
  applySnapshot(next, status);
}

async function importAndApplyPetAssetPack(
  snapshot: CompanionRuntimeSnapshot,
  selectedPath: string,
): Promise<CompanionRuntimeSnapshot | null> {
  try {
    const result = await tauriInvoke<{
      sourceAssetPackPath: string;
      assetPackPath: string;
      manifest: any | null;
      validation: { level: "ok" | "warning" | "error"; messages: string[] };
    }>("import_pet_asset_pack", { sourceAssetPackPath: selectedPath });

    const next = await loadPetAssetPackToSnapshot(snapshot, result.assetPackPath);
    const messages = result.validation?.messages ?? [];
    const statusPrefix = result.validation?.level === "error"
      ? t("companion.assetPackImportFailed", "形象包导入失败")
      : t("companion.assetPackImported", "形象已导入并切换");
    showToast(messages.length > 0 ? `${statusPrefix}: ${messages[0]}` : statusPrefix, result.validation?.level === "error" ? "error" : "success");
    return next;
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes("selection_cancelled")) return null;
    if (message.includes("tauri_invoke_unavailable")) {
      showToast(t("companion.assetPackTauriOnly", "当前入口不支持系统文件选择，请在桌面版窗口中操作"), "error");
      return null;
    }
    const normalized = message.includes("missing pet.json")
      ? t("companion.assetPackMissingPetJson", "所选文件夹缺少 pet.json")
      : message;
    showToast(`${t("companion.assetPackImportFailed", "形象包导入失败")}: ${normalized}`, "error");
    return null;
  }
}

async function pickPetAssetPackFolderPath(): Promise<string | null> {
  try {
    const sourcePath = await tauriInvoke<string>("pick_pet_asset_pack_folder");
    return sourcePath || null;
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes("selection_cancelled")) return null;
    if (message.includes("tauri_invoke_unavailable")) {
      showToast(t("companion.assetPackTauriOnly", "当前入口不支持系统文件选择，请在桌面版窗口中操作"), "error");
      return null;
    }
    showToast(`${t("companion.assetPackPickFailed", "选择文件夹失败")}: ${message}`, "error");
    return null;
  }
}

async function loadPetAssetPackToSnapshot(
  snapshot: CompanionRuntimeSnapshot,
  assetPackPath: string,
): Promise<CompanionRuntimeSnapshot> {
  try {
    const result = await tauriInvoke<{
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
    await tauriInvoke("show_control_center");
  } catch {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }
}

async function hideDesktopCompanionWindow(): Promise<void> {
  try {
    await tauriInvoke("hide_desktop_companion");
  } catch {
    const widget = document.querySelector<HTMLElement>(".pet-widget");
    if (widget) widget.style.display = "none";
  }
}
