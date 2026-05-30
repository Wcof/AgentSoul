// 上下文菜单（右键菜单）— 仿照 CCX 渠道卡片操作菜单
// 全 vanilla TS，点击外部自动关闭

let activeMenu: HTMLElement | null = null;

export interface ContextMenuItem {
  icon: string;
  label: string;
  action: () => void;
  danger?: boolean;
  separatorAfter?: boolean;
  disabled?: boolean;
}

/**
 * 在指定位置打开上下文菜单
 * @param x 菜单 X 坐标（视口）
 * @param y 菜单 Y 坐标（视口）
 * @param items 菜单项列表
 */
export function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
  closeContextMenu();

  const menu = document.createElement("div");
  menu.className = "channel-context-menu";
  menu.setAttribute("role", "menu");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    if (item.separatorAfter !== undefined && item.separatorAfter) {
      // 先加当前项，再加分隔符
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `context-menu-item${item.danger ? " context-menu-item--danger" : ""}`;
    btn.setAttribute("role", "menuitem");
    if (item.disabled) btn.disabled = true;

    btn.innerHTML = `<span class="context-menu-icon">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeContextMenu();
      item.action();
    });
    menu.appendChild(btn);

    if (item.separatorAfter) {
      const sep = document.createElement("div");
      sep.className = "context-menu-separator";
      menu.appendChild(sep);
    }
  }

  document.body.appendChild(menu);
  activeMenu = menu;

  // 边界修正：确保菜单不超出视口
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  });

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick, { once: true });
    document.addEventListener("contextmenu", handleOutsideClick, { once: true });
  }, 0);
}

export function closeContextMenu(): void {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

function handleOutsideClick(): void {
  closeContextMenu();
}
