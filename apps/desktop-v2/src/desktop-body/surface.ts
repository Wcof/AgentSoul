import type { CompanionInteractionKind, DesktopBodySnapshot } from "../types";
import { buildDesktopCompanionExperience, renderDesktopCompanionInlineExperience } from "./menu";
import { projectAutonomyRuntime } from "../agent-mind/autonomy-loop";
import { submitDesktopBodyInlineChat } from "./interaction-actions";
import { switchPetAssetPackInteractively } from "./appearance-pack";
import { showDesktopBodyStatus } from "./status-actions";
import { hideDesktopBodyWindow, refreshDesktopBodyRuntime, startDesktopBodyWindowDrag } from "./window";
import { escapeHtml } from "../shared/utils";

export function renderDesktopCompanionSurface(input: {
  target: HTMLElement;
  snapshot: DesktopBodySnapshot;
  status?: string;
  menuOpen?: boolean;
}): void {
  const experience = buildDesktopCompanionExperience(input.snapshot);
  const projection = projectAutonomyRuntime(input);
  const validation = experience.appearance.assetValidation;
  const assetNotice = validation?.level === "error"
    ? validation.messages[0] ?? "Asset pack unavailable"
    : "";
  input.target.innerHTML = `
    <section class="pet-widget" data-state="${escapeHtml(String(projection.visualState))}" data-asset-pack="${escapeHtml(experience.appearance.assetPackId ?? "")}" aria-label="Desktop Companion Widget">
      <div class="pet-widget__character" data-pet-widget-trigger data-tauri-drag-region>
        <canvas class="companion-canvas clean-avatar" width="220" height="220" style="width: 100%; height: 100%; display: block;"></canvas>
        <div class="pet-widget__loading" aria-hidden="true"></div>
        ${assetNotice ? `<div class="pet-widget__asset-notice" aria-hidden="true">${escapeHtml(assetNotice)}</div>` : ""}
      </div>
      ${input.menuOpen ? renderDesktopPetMenu({ ...experience, bubbleText: projection.bubbleText }, input.status) : ""}
    </section>
  `;
}

function renderDesktopPetMenu(
  experience: ReturnType<typeof buildDesktopCompanionExperience>,
  status: string | undefined,
): string {
  return `
    <div class="pet-widget__menu" data-pet-context-panel>
      <div class="pet-widget__menu-section">
        <p class="pet-widget__menu-label">交互</p>
        ${renderDesktopCompanionInlineExperience(experience)}
      </div>
      <div class="pet-widget__menu-section">
        <p class="pet-widget__menu-label">工具</p>
        <div class="pet-widget__tools" aria-label="Companion tools">
          <button type="button" data-pet-tool="status">状态</button>
          <button type="button" data-pet-tool="asset-pack">更换形象</button>
          <button type="button" data-pet-tool="refresh">刷新</button>
          <button type="button" data-pet-tool="hide">隐藏</button>
        </div>
      </div>
      ${status ? `<p class="pet-widget__menu-status" role="status">${escapeHtml(status)}</p>` : ""}
    </div>
  `;
}

export function bindDesktopCompanionSurface<TSnapshot extends DesktopBodySnapshot>(input: {
  target: HTMLElement;
  controller: {
    performInteraction: (kind: CompanionInteractionKind) => Promise<void>;
  };
  getSnapshot: () => TSnapshot;
  applySnapshot: (snapshot: TSnapshot, status: string) => void;
  onToggleMenu?: (open: boolean) => void;
}): void {
  if (typeof document !== "undefined") {
    const targetEl = input.target as any;
    if (targetEl.__menuClickOutsideHandler) {
      document.removeEventListener("click", targetEl.__menuClickOutsideHandler);
      targetEl.__menuClickOutsideHandler = null;
    }
    if (targetEl.__menuKeyDownHandler) {
      document.removeEventListener("keydown", targetEl.__menuKeyDownHandler);
      targetEl.__menuKeyDownHandler = null;
    }
    if (targetEl.__menuBlurHandler) {
      if (typeof window !== "undefined") {
        window.removeEventListener("blur", targetEl.__menuBlurHandler);
      }
      targetEl.__menuBlurHandler = null;
    }

    const hasMenu = !!input.target.querySelector("[data-pet-context-panel]");
    if (hasMenu) {
      const closeMenu = () => {
        if (input.target.classList.contains("pet-widget-menu-open")) {
          input.target.classList.remove("pet-widget-menu-open");
        }
        if (input.onToggleMenu) {
          input.onToggleMenu(false);
        } else {
          renderDesktopCompanionSurface({ target: input.target, snapshot: input.getSnapshot(), menuOpen: false });
          bindDesktopCompanionSurface(input);
        }
      };

      const handleOutsideClick = (event: MouseEvent) => {
        const eventTarget = event.target as HTMLElement | null;
        if (!eventTarget) return;
        const inCharacter = eventTarget.closest("[data-pet-widget-trigger]");
        const inMenu = eventTarget.closest("[data-pet-context-panel]");
        if (!inCharacter && !inMenu) {
          closeMenu();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" || event.key === "Esc") {
          closeMenu();
        }
      };

      setTimeout(() => {
        const currentHasMenu = !!input.target.querySelector("[data-pet-context-panel]");
        if (currentHasMenu) {
          document.addEventListener("click", handleOutsideClick);
          document.addEventListener("keydown", handleKeyDown);
          if (typeof window !== "undefined") {
            window.addEventListener("blur", closeMenu);
            targetEl.__menuBlurHandler = closeMenu;
          }
          targetEl.__menuClickOutsideHandler = handleOutsideClick;
          targetEl.__menuKeyDownHandler = handleKeyDown;
        }
      }, 0);
    }
  }

  input.target.querySelectorAll<HTMLElement>("[data-pet-widget-trigger]").forEach((el) => {
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.detail > 1) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button,input,textarea,select,[data-pet-context-panel]")) return;
      void startDesktopBodyWindowDrag();
    });

    el.addEventListener("click", (event) => {
      if ((event.target as HTMLElement | null)?.closest("[data-pet-context-panel]")) return;
      el.classList.remove("pet-widget-hit");
      void el.offsetWidth;
      el.classList.add("pet-widget-hit");
    });

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const nextOpen = !input.target.classList.contains("pet-widget-menu-open");
      input.target.classList.toggle("pet-widget-menu-open", nextOpen);
      if (input.onToggleMenu) {
        input.onToggleMenu(nextOpen);
      } else {
        renderDesktopCompanionSurface({ target: input.target, snapshot: input.getSnapshot(), menuOpen: nextOpen });
        input.target.classList.toggle("pet-widget-menu-open", nextOpen);
        bindDesktopCompanionSurface(input);
      }
    });
  });

  bindDesktopInlineChat(input.target, input.getSnapshot, input.applySnapshot);
  bindDesktopQuickActions(input.target, input.controller);
  bindDesktopToolActions(input.target, input.getSnapshot, input.applySnapshot);
}

function bindDesktopInlineChat<TSnapshot extends DesktopBodySnapshot>(
  target: HTMLElement,
  getSnapshot: () => TSnapshot,
  applySnapshot: (snapshot: TSnapshot, status: string) => void,
): void {
  target.querySelectorAll<HTMLFormElement>("[data-companion-inline-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>("[data-companion-inline-input]");
      const content = input?.value.trim();
      if (!content) return;
      if (input) input.value = "";
      void surfaceSubmitDesktopInlineChat(target, getSnapshot, applySnapshot, content);
    });
  });
}

function bindDesktopQuickActions(
  target: HTMLElement,
  controller: {
    performInteraction: (kind: CompanionInteractionKind) => Promise<void>;
  },
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-interaction]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.interaction;
      if (!kind) return;
      void controller.performInteraction(kind as Parameters<typeof controller.performInteraction>[0]);
    });
  });
}

function bindDesktopToolActions<TSnapshot extends DesktopBodySnapshot>(
  target: HTMLElement,
  getSnapshot: () => TSnapshot,
  applySnapshot: (snapshot: TSnapshot, status: string) => void,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-pet-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.petTool;
      if (tool === "status") {
        showDesktopBodyStatus(getSnapshot());
      } else if (tool === "asset-pack") {
        void switchPetAssetPackInteractively(getSnapshot, applySnapshot);
      } else if (tool === "refresh") {
        refreshDesktopBodyRuntime();
      } else if (tool === "hide") {
        void hideDesktopBodyWindow();
      }
    });
  });
}

async function surfaceSubmitDesktopInlineChat<TSnapshot extends DesktopBodySnapshot>(
  target: HTMLElement,
  getSnapshot: () => TSnapshot,
  applySnapshot: (snapshot: TSnapshot, status: string) => void,
  content: string,
): Promise<void> {
  surfaceUpdateDesktopBubble(target, "我在想...");
  const turn = await submitDesktopBodyInlineChat({
    message: content,
    snapshot: getSnapshot(),
  });
  surfaceUpdateDesktopBubble(target, turn.bubbleText);
  applySnapshot(turn.nextSnapshot, turn.status);
}

function surfaceUpdateDesktopBubble(target: HTMLElement, text: string): void {
  const bubble = target.querySelector<HTMLElement>(".pet-widget__bubble");
  if (bubble) bubble.textContent = text;
}
