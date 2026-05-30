// Modal 弹窗系统 — 基于原生 <dialog> 元素，适配 AgentSoul 暗色玻璃态主题
// 提供 openModal / closeModal / confirmDialog 三个核心 API

/**
 * 创建并打开一个 Modal 弹窗
 * @param contentHtml Modal 内容 HTML（不含 <dialog> 外壳）
 * @param options 配置项
 * @returns HTMLDialogElement 实例
 */
export function openModal(
  contentHtml: string,
  options: {
    className?: string;
    onClose?: () => void;
    maxWidth?: string;
  } = {},
): HTMLDialogElement {
  // 移除已有弹窗（同一时间只允许一个）
  closeModal();

  const dialog = document.createElement("dialog");
  dialog.className = `agentsoul-modal ${options.className ?? ""}`.trim();
  if (options.maxWidth) {
    dialog.style.setProperty("--modal-max-width", options.maxWidth);
  }

  dialog.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal-content" role="dialog" aria-modal="true">
      <button type="button" class="modal-close-btn" data-modal-close aria-label="Close">&times;</button>
      ${contentHtml}
    </div>
  `;

  // 关闭事件
  dialog.addEventListener("close", () => {
    options.onClose?.();
    dialog.remove();
  });

  // 点击 backdrop 关闭
  dialog.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", () => dialog.close());
  });

  document.body.appendChild(dialog);
  dialog.showModal();

  // 聚焦第一个可交互元素
  const firstInput = dialog.querySelector<HTMLInputElement>(
    "input:not([type=hidden]), textarea, select",
  );
  if (firstInput) {
    requestAnimationFrame(() => firstInput.focus());
  }

  return dialog;
}

/** 关闭当前打开的 Modal */
export function closeModal(): void {
  const existing = document.querySelector<HTMLDialogElement>("dialog.agentsoul-modal");
  if (existing) {
    existing.close();
    existing.remove();
  }
}

/**
 * 确认对话框
 * @param title 标题
 * @param message 消息内容
 * @param options 配置
 * @returns Promise<boolean> 用户是否确认
 */
export function confirmDialog(
  title: string,
  message: string,
  options: {
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmLabel = options.confirmText ?? "Confirm";
    const cancelLabel = options.cancelText ?? "Cancel";
    const btnClass = options.danger ? "modal-btn modal-btn--danger" : "modal-btn modal-btn--primary";

    const dialog = openModal(
      `
      <div class="confirm-dialog">
        <h2 class="confirm-title">${escapeHtml(title)}</h2>
        <p class="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button type="button" class="modal-btn modal-btn--ghost" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="${btnClass}" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `,
      {
        maxWidth: "400px",
        onClose: () => resolve(false),
      },
    );

    dialog.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => {
      resolve(false);
      dialog.close();
    });
    dialog.querySelector("[data-confirm-ok]")?.addEventListener("click", () => {
      resolve(true);
      dialog.close();
    });
  });
}

/** Toast 通知（轻量级） */
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: "success" | "error" | "info" = "info", durationMs = 3000): void {
  // 移除已有 toast
  const existing = document.querySelector(".agentsoul-toast");
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement("div");
  toast.className = `agentsoul-toast agentsoul-toast--${type}`;
  toast.textContent = message;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("agentsoul-toast--visible"));

  toastTimer = setTimeout(() => {
    toast.classList.remove("agentsoul-toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
