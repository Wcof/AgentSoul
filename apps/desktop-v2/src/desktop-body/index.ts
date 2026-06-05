export { renderDesktopCompanionSurface, bindDesktopCompanionSurface } from "../desktop-companion-surface";
export { bootstrapDesktopBody, loadDesktopBodySnapshot, mergeDesktopBodyNativeState } from "./bootstrap";
export { applyDesktopBodyInteraction, submitDesktopBodyInlineChat } from "./interaction-actions";
export { importAndApplyPetAssetPack, loadPetAssetPackToSnapshot, pickPetAssetPackFolderPath, switchPetAssetPackInteractively } from "./pet-appearance-actions";
export { showDesktopBodyStatus } from "./status-actions";
export { hideDesktopBodyWindow, refreshDesktopBodyRuntime, startDesktopBodyWindowDrag } from "./window-actions";
export { createCanvasRenderer, startAnimationLoop } from "../canvas-renderer";
export { normalizePetAssetPack, resolveRenderableSpriteSrc } from "../utils/petAssetPack";
export { initWindowSnap, saveWindowPosition, restoreWindowPosition } from "../utils/windowSnap";
