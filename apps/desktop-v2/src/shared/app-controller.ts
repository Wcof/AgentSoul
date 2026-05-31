/**
 * Shared App Controller — createDesktopCompanionController
 * The main orchestration function that creates the controller and wires everything together.
 */
import type {
  CompanionRuntimeSnapshot,
  DesktopCompanionController,
  DesktopCompanionControllerOptions,
  CompanionInteractionKind,
} from "../types";
import { defaultCompanionSnapshot } from "../data/defaultSnapshot";
import { renderAgentSoulShell, renderDesktopCompanionWidget } from "./shell";
import { labelForInteraction, resolveVisualState, errorMessage } from "./utils";
import { createCanvasRenderer, startAnimationLoop } from "../canvas-renderer";
import { bindControlCenterNavigation } from "./nav";
import { bindInteractionControls, bindCompanionCustomization, bindDesktopPetWidgetControls } from "../areas/companion/bind";
import { bindApprovalControls } from "../areas/safety/bind";
import { bindChannelControls } from "../areas/gateway/bind";
import { bindLocaleToggle } from "../areas/settings/bind";
import { bindSkillControls } from "../areas/skills/bind";
import { bindSafetyControls } from "../areas/safety/bind";
import { bindSessionControls } from "../areas/sessions/bind";
import { bindMcpControls } from "../areas/mcp/bind";
import { bindPromptControls } from "../areas/prompts/bind";
import { bindSettingsTabs } from "../areas/settings-full/bind";
import { bindConversationDashboardControls } from "../areas/conversations/bind";
import { bindChartControls } from "../areas/costs/bind";
import { bindUpdateDialogControls } from "./app-switcher";
import { bindAppSwitcherControls } from "./app-switcher";
import { bindUsageFooterControls } from "./usage-footer";

export function createDesktopCompanionController(
  options: DesktopCompanionControllerOptions,
): DesktopCompanionController {
  let currentSnapshot = options.initialSnapshot ?? defaultCompanionSnapshot;
  let pendingApproval = options.initialPendingApproval;
  const riskNotices = options.initialRiskNotices ?? [];
  let cancelAnimation: (() => void) | undefined;

  const controller: DesktopCompanionController = {
    render(snapshot = currentSnapshot, status) {
      if (cancelAnimation) { cancelAnimation(); cancelAnimation = undefined; }
      currentSnapshot = snapshot;
      const shellMode = options.shellMode ?? "control-center";
      if (shellMode === "desktop-companion") {
        renderDesktopCompanionWidget(options.target, currentSnapshot, status);
      } else {
        renderAgentSoulShell(options.target, currentSnapshot, status, pendingApproval, riskNotices);
      }

      const canvas = options.target.querySelector<HTMLCanvasElement>(".companion-canvas");
      if (canvas) {
        try {
          const renderer = createCanvasRenderer(canvas);
          cancelAnimation = startAnimationLoop(renderer, () => currentSnapshot.companion.petAppearance, () => resolveVisualState(currentSnapshot));
        } catch (e) { console.error("Failed to start canvas loop:", e); }
      }

      bindInteractionControls(options.target, controller);
      bindApprovalControls(options.target, controller);
      if (shellMode === "desktop-companion") {
        bindDesktopPetWidgetControls(options.target, controller, () => currentSnapshot, (snapshot, status) => { currentSnapshot = snapshot; controller.render(snapshot, status); });
      } else {
        bindControlCenterNavigation(options.target);
        bindChannelControls(options.target, currentSnapshot, controller, options.controlClient);
        bindLocaleToggle(options.target, controller);
        bindCompanionCustomization(options.target, currentSnapshot, controller);
        bindSkillControls(options.target, currentSnapshot, controller, options.controlClient);
        bindSafetyControls(options.target, currentSnapshot, controller, options.controlClient);
        bindSessionControls(options.target, currentSnapshot, controller, options.controlClient);
        bindMcpControls(options.target, currentSnapshot, controller, options.controlClient);
        bindPromptControls(options.target, currentSnapshot, controller, options.controlClient);
        bindSettingsTabs(options.target, currentSnapshot, options.controlClient);
        bindConversationDashboardControls(options.target, currentSnapshot, controller);
        bindChartControls(options.target, currentSnapshot, controller, options.controlClient);
        bindUpdateDialogControls(options.target);
        bindAppSwitcherControls(options.target, currentSnapshot, controller);
        bindUsageFooterControls(options.target, currentSnapshot, controller, options.controlClient);
        // Backup and WebDAV controls are bound via bindSettingsTabs in settings-full
      }
    },
    async performInteraction(kind) {
      try {
        const result = await options.performInteraction(kind);
        const status = result.outcome === "blocked-low-energy" ? "Play blocked: Companion Energy is too low." : `${labelForInteraction(kind)} applied.`;
        controller.render(result.state, status);
      } catch (error) {
        controller.render(currentSnapshot, `Interaction failed: ${errorMessage(error)}`);
      }
    },
    async decideApproval(kind) {
      if (!pendingApproval) { controller.render(currentSnapshot, "No pending approval."); return; }
      const requestId = pendingApproval.id;
      try {
        await options.decideApproval?.(requestId, kind);
        pendingApproval = undefined;
        controller.render(currentSnapshot, kind === "allowed" ? "Approval allowed." : "Approval denied.");
      } catch (error) {
        controller.render(currentSnapshot, `Approval decision failed: ${errorMessage(error)}`);
      }
    },
  };

  controller.render(currentSnapshot);
  return controller;
}
