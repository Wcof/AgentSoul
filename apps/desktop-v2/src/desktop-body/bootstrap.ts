import type { DesktopBodySnapshot, NativeCompanionRuntimeState } from "../types";
import { createCanvasRenderer, startAnimationLoop } from "./animation";
import { normalizeAutonomySnapshot } from "../agent-mind/autonomy-loop";
import { defaultCompanionSnapshot } from "../data/defaultSnapshot";
import { renderDesktopCompanionSurface, bindDesktopCompanionSurface } from "./surface";
import i18n from "../i18n";
import { resolveVisualState } from "../shared/utils";
import { tauriInvoke } from "../utils/tauriIpc";
import { initWindowSnap } from "../utils/windowSnap";
import { applyDesktopBodyInteraction } from "./interaction-actions";

export async function bootstrapDesktopBody(target: HTMLElement): Promise<void> {
  document.body.classList.add("desktop-companion-mode");
  void initWindowSnap();

  let snapshot = await loadDesktopBodySnapshot();
  const language = snapshot.desktopPreferences?.language;
  if (isSupportedLocale(language) && i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  let cancelAnimation: (() => void) | undefined;
  let menuOpen = false;
  const render = (nextSnapshot = snapshot, status?: string) => {
    if (cancelAnimation) {
      cancelAnimation();
      cancelAnimation = undefined;
    }

    snapshot = nextSnapshot;
    renderDesktopCompanionSurface({ target, snapshot, status, menuOpen });

    const canvas = target.querySelector<HTMLCanvasElement>(".companion-canvas");
    if (canvas) {
      const renderer = createCanvasRenderer(canvas);
      cancelAnimation = startAnimationLoop(
        renderer,
        () => snapshot.companion.petAppearance,
        () => resolveVisualState(snapshot),
      );
    }

    bindDesktopCompanionSurface({
      target,
      controller: {
        performInteraction: async (kind) => {
          const result = applyDesktopBodyInteraction(snapshot, kind);
          render(result.state, result.status);
        },
      },
      getSnapshot: () => snapshot,
      applySnapshot: (appliedSnapshot, statusMessage) => render(appliedSnapshot, statusMessage),
      onToggleMenu: (open) => {
        menuOpen = open;
        render(snapshot);
      },
    });
  };

  render(snapshot);
}

export async function loadDesktopBodySnapshot(): Promise<DesktopBodySnapshot> {
  try {
    const nativeState = await tauriInvoke<NativeCompanionRuntimeState>("get_companion_runtime_state");
    const merged = mergeDesktopBodyNativeState(defaultCompanionSnapshot, nativeState);
    const assetPackPath = merged.companion.petAppearance.assetPackPath;
    if (!assetPackPath) return merged;

    try {
      const packResult = await tauriInvoke<{
        manifest: { spritesheetDataUrl?: string } | null;
        validation: { level: "ok" | "warning" | "error"; messages: string[] };
      }>("load_pet_asset_pack", { assetPackPath });
      return {
        ...merged,
        companion: {
          ...merged.companion,
          petAppearance: {
            ...merged.companion.petAppearance,
            spritesheetDataUrl: typeof packResult.manifest?.spritesheetDataUrl === "string"
              ? packResult.manifest.spritesheetDataUrl
              : merged.companion.petAppearance.spritesheetDataUrl,
            assetManifest: merged.companion.petAppearance.assetManifest,
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

export function mergeDesktopBodyNativeState(
  fallback: DesktopBodySnapshot,
  nativeState: NativeCompanionRuntimeState,
): DesktopBodySnapshot {
  return {
    ...fallback,
    companion: {
      ...fallback.companion,
      ...nativeState.companion,
      petAppearance: { ...fallback.companion.petAppearance, ...nativeState.companion?.petAppearance },
      vitals: { ...fallback.companion.vitals, ...nativeState.companion?.vitals },
      autonomy: normalizeAutonomySnapshot({
        ...(fallback.companion.autonomy ?? {}),
        ...(nativeState.companion?.autonomy ?? {}),
      } as DesktopBodySnapshot["companion"]["autonomy"]),
      masterModel: nativeState.companion?.masterModel ?? fallback.companion.masterModel,
    },
    providerProfile: { ...fallback.providerProfile, ...nativeState.providerProfile },
    desktopPreferences: {
      language: nativeState.desktopPreferences?.language ?? fallback.desktopPreferences?.language ?? "zh",
    },
  };
}

function isSupportedLocale(value: unknown): value is "zh" | "en" {
  return value === "zh" || value === "en";
}
