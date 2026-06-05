/**
 * Desktop companion placement — remember the user's manual position.
 *
 * The pet should stay where the user drags it. We intentionally do not
 * auto-snap to screen edges.
 */

import { tauriInvoke } from "./tauriIpc";

interface StoredWindowPosition {
  x: number;
  y: number;
}

const POSITION_STORAGE_KEY = "agentsoul_companion_position";

export async function initWindowSnap(): Promise<void> {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const currentWindow = getCurrentWebviewWindow();
    const label = currentWindow.label;
    if (label !== "desktop-companion") return;

    await restoreWindowPosition(label);
    await currentWindow.onMoved(async ({ payload: position }) => {
      saveWindowPosition(position.x, position.y);
    });
  } catch (error) {
    console.debug("Window placement not available:", error);
  }
}

export async function restoreWindowPosition(label: string): Promise<void> {
  const savedPosition = loadWindowPosition();
  if (!savedPosition) return;
  try {
    await tauriInvoke("set_window_position", { label, x: savedPosition.x, y: savedPosition.y });
  } catch (error) {
    console.debug("Restore window position failed:", error);
  }
}

export function saveWindowPosition(x: number, y: number): void {
  try {
    const value: StoredWindowPosition = { x: Math.round(x), y: Math.round(y) };
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

function loadWindowPosition(): StoredWindowPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWindowPosition>;
    if (typeof parsed.x === "number" && Number.isFinite(parsed.x) && typeof parsed.y === "number" && Number.isFinite(parsed.y)) {
      return { x: Math.round(parsed.x), y: Math.round(parsed.y) };
    }
  } catch {
    // Ignore invalid storage.
  }
  return null;
}
