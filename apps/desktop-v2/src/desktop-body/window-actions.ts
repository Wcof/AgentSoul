import { tauriInvoke } from "../utils/tauriIpc";

export async function startDesktopBodyWindowDrag(): Promise<void> {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await getCurrentWebviewWindow().startDragging();
  } catch {
    // Browser preview and older runtimes do not support native window dragging.
  }
}

export function refreshDesktopBodyRuntime(): void {
  window.location.reload();
}

export async function hideDesktopBodyWindow(): Promise<void> {
  try {
    await tauriInvoke("hide_desktop_companion");
  } catch {
    const widget = document.querySelector<HTMLElement>(".pet-widget");
    if (widget) widget.style.display = "none";
  }
}
