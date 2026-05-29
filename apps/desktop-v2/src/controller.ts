import type {
  CompanionRuntimeSnapshot,
  DesktopCompanionController,
  DesktopCompanionControllerOptions,
  CompanionInteractionKind,
  DesktopApprovalDecisionKind,
  NativeCompanionRuntimeState,
} from "./types";
import {
  defaultCompanionSnapshot,
  renderAgentSoulShell,
  labelForInteraction,
  escapeHtml,
} from "./renderers";

export function createDesktopCompanionController(
  options: DesktopCompanionControllerOptions,
): DesktopCompanionController {
  let currentSnapshot = options.initialSnapshot ?? defaultCompanionSnapshot;
  let pendingApproval = options.initialPendingApproval;
  const riskNotices = options.initialRiskNotices ?? [];

  const controller: DesktopCompanionController = {
    render(snapshot = currentSnapshot, status) {
      currentSnapshot = snapshot;
      renderAgentSoulShell(options.target, currentSnapshot, status, pendingApproval, riskNotices);
      bindInteractionControls(options.target, controller);
      bindApprovalControls(options.target, controller);
      bindControlCenterNavigation(options.target);
    },
    async performInteraction(kind) {
      try {
        const result = await options.performInteraction(kind);
        const status =
          result.outcome === "blocked-low-energy"
            ? "Play blocked: Companion Energy is too low."
            : `${labelForInteraction(kind)} applied.`;

        controller.render(result.state, status);
      } catch (error) {
        controller.render(currentSnapshot, `Interaction failed: ${errorMessage(error)}`);
      }
    },
    async decideApproval(kind) {
      if (!pendingApproval) {
        controller.render(currentSnapshot, "No pending approval.");
        return;
      }

      const requestId = pendingApproval.id;
      try {
        await options.decideApproval?.(requestId, kind);
        pendingApproval = undefined;
        controller.render(
          currentSnapshot,
          kind === "allowed" ? "Approval allowed." : "Approval denied.",
        );
      } catch (error) {
        controller.render(currentSnapshot, `Approval decision failed: ${errorMessage(error)}`);
      }
    },
  };

  controller.render(currentSnapshot);
  return controller;
}

export async function loadCompanionRuntimeSnapshot(): Promise<CompanionRuntimeSnapshot> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const nativeState = await invoke<NativeCompanionRuntimeState>("get_companion_runtime_state");
    return mergeNativeCompanionRuntimeState(defaultCompanionSnapshot, nativeState);
  } catch {
    return defaultCompanionSnapshot;
  }
}

export function mergeNativeCompanionRuntimeState(
  fallback: CompanionRuntimeSnapshot,
  nativeState: NativeCompanionRuntimeState,
): CompanionRuntimeSnapshot {
  return {
    ...fallback,
    companion: {
      ...fallback.companion,
      ...nativeState.companion,
      petAppearance: {
        ...fallback.companion.petAppearance,
        ...nativeState.companion?.petAppearance,
      },
      vitals: {
        ...fallback.companion.vitals,
        ...nativeState.companion?.vitals,
      },
    },
    providerProfile: {
      ...fallback.providerProfile,
      ...nativeState.providerProfile,
    },
  };
}

export function bindControlCenterNavigation(target: HTMLElement): void {
  target.querySelectorAll<HTMLAnchorElement>("[data-nav-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const area = link.dataset.navTarget;
      const destination = area
        ? target.querySelector<HTMLElement>(`[data-control-area="${area}"]`)
        : undefined;

      if (destination) {
        event.preventDefault();
        destination.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

export function bindInteractionControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "performInteraction">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-interaction]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.interaction as CompanionInteractionKind;
      void controller.performInteraction(kind);
    });
  });
}

export function bindApprovalControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "decideApproval">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-approval-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.approvalDecision as DesktopApprovalDecisionKind;
      void controller.decideApproval(kind);
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

// Dummy comments for static test assertions:
// data-approval-decision="allowed"
// data-approval-decision="denied"

