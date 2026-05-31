/**
 * Conversations Area — bind functions
 */
import type { AreaContext, ConversationKind } from "../../types";
import { t } from "../../shared/utils";
import { showToast } from "../../utils/modal";

export function bindConversationsArea(ctx: AreaContext): void {
  bindConversationDashboardControls(ctx.target, ctx.snapshot, ctx.controller);
}

export function bindConversationDashboardControls(
  target: HTMLElement,
  snapshot: import("../../types").CompanionRuntimeSnapshot,
  controller?: import("../../types").DesktopCompanionController,
): void {
  const rerender = () => controller?.render(snapshot);

  target.querySelectorAll<HTMLButtonElement>("[data-kind-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      snapshot.conversationDashboard.activeFilter = btn.dataset.kindFilter as ConversationKind | "";
      rerender();
    });
  });

  target.querySelectorAll<HTMLInputElement>("[data-conversation-search]").forEach((input) => {
    input.addEventListener("input", () => {
      snapshot.conversationDashboard.searchQuery = input.value.trim();
      rerender();
    });
  });

  target.querySelectorAll<HTMLElement>("[data-conversation-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const convId = card.dataset.conversationId!;
      const shell = target.querySelector<HTMLElement>(".shell");
      if (shell) shell.setAttribute("data-active-tab", "sessions-mgr");
      showToast(t("cockpit.openConversation", "Opening conversation") + ": " + convId, "info");
    });
  });
}
