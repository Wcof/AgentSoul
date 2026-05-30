// 拖拽排序 — 仿照 CCX 的渠道优先级拖拽重排
// 全 vanilla TS，无需第三方库

let draggedElement: HTMLElement | null = null;
let draggedChannelId: string | null = null;
let placeholder: HTMLElement | null = null;

export interface DragReorderCallbacks {
  onReorder: (channelIds: string[]) => void;
}

/**
 * 为渠道列表启用拖拽排序
 * @param listContainer 渠道列表容器元素
 * @param callbacks 重排回调
 */
export function enableChannelDragReorder(
  listContainer: HTMLElement,
  callbacks: DragReorderCallbacks,
): void {
  const items = listContainer.querySelectorAll<HTMLElement>("[data-channel-id]");

  items.forEach((item) => {
    item.setAttribute("draggable", "true");
    item.style.cursor = "grab";

    item.addEventListener("dragstart", (e) => {
      draggedElement = item;
      draggedChannelId = item.dataset.channelId || null;
      item.style.opacity = "0.5";
      item.style.cursor = "grabbing";
      e.dataTransfer!.effectAllowed = "move";
      e.dataTransfer!.setData("text/plain", draggedChannelId || "");

      // 创建占位符
      placeholder = document.createElement("div");
      placeholder.className = "drag-placeholder";
      placeholder.style.height = `${item.offsetHeight}px`;
      placeholder.style.border = "2px dashed rgba(59, 130, 246, 0.4)";
      placeholder.style.borderRadius = "12px";
      placeholder.style.background = "rgba(59, 130, 246, 0.05)";
      placeholder.style.transition = "all 0.2s";
    });

    item.addEventListener("dragend", () => {
      if (draggedElement) {
        draggedElement.style.opacity = "";
        draggedElement.style.cursor = "grab";
      }
      if (placeholder && placeholder.parentNode) {
        placeholder.remove();
      }
      draggedElement = null;
      draggedChannelId = null;
      placeholder = null;

      // 收集新的顺序
      const newOrder = Array.from(
        listContainer.querySelectorAll<HTMLElement>("[data-channel-id]"),
      )
        .map((el) => el.dataset.channelId)
        .filter(Boolean) as string[];
      callbacks.onReorder(newOrder);
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";

      if (!draggedElement || item === draggedElement) return;

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (e.clientY < midY) {
        item.parentNode!.insertBefore(draggedElement, item);
      } else {
        item.parentNode!.insertBefore(draggedElement, item.nextSibling);
      }
    });
  });

  // 容器级 dragover 放置
  listContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  });
}
