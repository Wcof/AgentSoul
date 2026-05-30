/**
 * Window Snap — 桌面伴侣窗口自动吸附到屏幕边缘
 *
 * 监听 Tauri 窗口拖拽结束事件，判断是否靠近屏幕边缘，
 * 如果在阈值范围内则自动吸附到对应边缘。
 */

const SNAP_THRESHOLD = 30; // px — 距离边缘多少像素内触发吸附
const SNAP_ANIMATION_DURATION = 200; // ms

export type SnapEdge = "left" | "right" | "top" | "bottom" | "none";

interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
}

interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 初始化桌面伴侣窗口的自动吸附行为
 * 仅在 desktop-companion 模式下生效
 */
export async function initWindowSnap(): Promise<void> {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { invoke } = await import("@tauri-apps/api/core");

    const currentWindow = getCurrentWebviewWindow();
    const label = currentWindow.label;

    // 仅对 desktop-companion 窗口生效
    if (label !== "desktop-companion") return;

    // 监听窗口移动结束事件
    await currentWindow.onMoved(async ({ payload: position }) => {
      try {
        const screenInfo = (await invoke("get_screen_info")) as ScreenInfo;
        const winInfo = (await invoke("get_window_info", { label })) as WindowInfo;

        // 计算物理像素下的屏幕边界
        const screenW = screenInfo.width;
        const screenH = screenInfo.height;

        const winRight = position.x + winInfo.width;
        const winBottom = position.y + winInfo.height;

        // 判断最近的边缘
        const distances: { edge: SnapEdge; dist: number }[] = [
          { edge: "left", dist: Math.abs(position.x) },
          { edge: "right", dist: Math.abs(screenW - winRight) },
          { edge: "top", dist: Math.abs(position.y) },
          { edge: "bottom", dist: Math.abs(screenH - winBottom) },
        ];

        distances.sort((a, b) => a.dist - b.dist);
        const closest = distances[0];

        if (closest.dist <= SNAP_THRESHOLD) {
          let snapX = position.x;
          let snapY = position.y;

          switch (closest.edge) {
            case "left":
              snapX = 0;
              break;
            case "right":
              snapX = screenW - winInfo.width;
              break;
            case "top":
              snapY = 0;
              break;
            case "bottom":
              snapY = screenH - winInfo.height;
              break;
          }

          await invoke("set_window_position", {
            label,
            x: snapX,
            y: snapY,
          });

          // 保存吸附位置到 localStorage
          saveSnapEdge(closest.edge);
        }
      } catch (e) {
        // 静默处理 — 吸附失败不影响核心功能
        console.debug("Window snap check failed:", e);
      }
    });

    // 启动时恢复上次保存的吸附位置
    await restoreSnapPosition(invoke, label);
  } catch (e) {
    // Tauri API 不可用（浏览器模式），忽略
    console.debug("Window snap not available:", e);
  }
}

/**
 * 启动时恢复上次保存的吸附位置
 */
async function restoreSnapPosition(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
  label: string,
): Promise<void> {
  try {
    const savedEdge = loadSnapEdge();
    if (!savedEdge || savedEdge === "none") return;

    const screenInfo = (await invoke("get_screen_info")) as ScreenInfo;
    const winInfo = (await invoke("get_window_info", { label })) as WindowInfo;

    let x = winInfo.x;
    let y = winInfo.y;

    switch (savedEdge) {
      case "left":
        x = 0;
        break;
      case "right":
        x = screenInfo.width - winInfo.width;
        break;
      case "top":
        y = 0;
        break;
      case "bottom":
        y = screenInfo.height - winInfo.height;
        break;
    }

    await invoke("set_window_position", { label, x, y });
  } catch (e) {
    console.debug("Restore snap position failed:", e);
  }
}

const STORAGE_KEY = "agentsoul_companion_snap_edge";

function saveSnapEdge(edge: SnapEdge): void {
  try {
    localStorage.setItem(STORAGE_KEY, edge);
  } catch {
    // Ignore
  }
}

function loadSnapEdge(): SnapEdge | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && ["left", "right", "top", "bottom"].includes(raw)) {
      return raw as SnapEdge;
    }
  } catch {
    // Ignore
  }
  return null;
}
