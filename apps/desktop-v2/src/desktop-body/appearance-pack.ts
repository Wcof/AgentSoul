import type { DesktopBodySnapshot } from "../types";
import { showToast } from "../utils/modal";
import { tauriInvoke } from "../utils/tauriIpc";

type AssetValidation = { level: "ok" | "warning" | "error"; messages: string[] };

export async function switchPetAssetPackInteractively<TSnapshot extends DesktopBodySnapshot>(
  getSnapshot: () => TSnapshot,
  applySnapshot: (snapshot: TSnapshot, status: string) => void,
): Promise<void> {
  const current = getSnapshot();
  const pickedPath = await pickPetAssetPackFolderPath();
  if (!pickedPath) return;
  const next = await importAndApplyPetAssetPack(current, pickedPath);
  if (!next) return;
  const messages = next.companion.petAppearance.assetValidation?.messages ?? [];
  const statusPrefix = next.companion.petAppearance.assetValidation?.level === "error"
    ? "Asset pack load failed"
    : "Asset pack loaded";
  applySnapshot(next, messages.length > 0 ? `${statusPrefix}: ${messages[0]}` : statusPrefix);
}

export async function importAndApplyPetAssetPack<TSnapshot extends DesktopBodySnapshot>(
  snapshot: TSnapshot,
  selectedPath: string,
): Promise<TSnapshot | null> {
  try {
    const result = await tauriInvoke<{
      sourceAssetPackPath: string;
      assetPackPath: string;
      manifest: any | null;
      validation: AssetValidation;
    }>("import_pet_asset_pack", { sourceAssetPackPath: selectedPath });
    const loaded = await loadPetAssetPackToSnapshot(snapshot, result.assetPackPath);
    const manifest = loaded.companion.petAppearance.assetManifest ?? result.manifest ?? {};
    const displayName = typeof manifest.displayName === "string" ? manifest.displayName : snapshot.companion.petAppearance.displayName;
    const assetPackId = typeof manifest.id === "string" ? manifest.id : snapshot.companion.petAppearance.assetPackId;
    const spritesheetPath = typeof manifest.spritesheetPath === "string" ? manifest.spritesheetPath : snapshot.companion.petAppearance.spritesheetPath;
    const version = typeof manifest.version === "string" ? manifest.version : snapshot.companion.petAppearance.assetPackVersion;
    return {
      ...loaded,
      companion: {
        ...loaded.companion,
        displayName: displayName ?? snapshot.companion.displayName,
        petAppearance: {
          ...loaded.companion.petAppearance,
          kind: "custom",
          skin: assetPackId ?? "custom",
          assetPackId,
          assetPackPath: result.assetPackPath,
          displayName,
          spritesheetPath,
          assetPackVersion: version,
          assetValidation: result.validation,
          assetManifest: manifest,
        },
      },
      companionCustomization: {
        ...snapshot.companionCustomization!,
        currentKind: "custom",
        currentSkin: assetPackId ?? "custom",
        displayName: displayName ?? snapshot.companionCustomization?.displayName ?? snapshot.companion.displayName,
      },
    } as TSnapshot;
  } catch (error) {
    showToast(`Asset pack import failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    return null;
  }
}

export async function pickPetAssetPackFolderPath(): Promise<string | null> {
  try {
    const sourcePath = await tauriInvoke<string>("pick_pet_asset_pack_folder");
    return sourcePath || null;
  } catch (error) {
    showToast(`Open folder picker failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    return null;
  }
}

export async function loadPetAssetPackToSnapshot<TSnapshot extends DesktopBodySnapshot>(
  snapshot: TSnapshot,
  assetPackPath: string,
): Promise<TSnapshot> {
  try {
    const result = await tauriInvoke<{
      assetPackPath: string;
      manifest: any | null;
      validation: AssetValidation;
    }>("load_pet_asset_pack", { assetPackPath });
    const manifest = result.manifest ?? {};
    const spritePath = typeof manifest.spritesheetPath === "string" ? manifest.spritesheetPath : `${assetPackPath}/spritesheet.webp`;
    const spriteDataUrl = typeof manifest.spritesheetDataUrl === "string" ? manifest.spritesheetDataUrl : undefined;
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
          spritesheetDataUrl: spriteDataUrl,
          assetPackVersion: typeof manifest.version === "string" ? manifest.version : "codex-pet-v1",
          assetManifest: manifest || undefined,
          assetValidation: result.validation,
        },
      },
    } as TSnapshot;
  } catch (error) {
    return {
      ...snapshot,
      companion: {
        ...snapshot.companion,
        petAppearance: {
          ...snapshot.companion.petAppearance,
          assetValidation: {
            level: "error",
            messages: [error instanceof Error ? error.message : String(error)],
          },
        },
      },
    } as TSnapshot;
  }
}
