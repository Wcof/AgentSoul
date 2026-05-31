/**
 * Skills Area — bind functions
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike } from "../../types";
import { t } from "../../shared/utils";
import { showToast } from "../../utils/modal";

export function bindSkillsArea(ctx: AreaContext): void {
  bindSkillControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindSkillControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-skill-activation]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const skillId = btn.dataset.skillActivation!;
      const activation = snapshot.skills.projectActivations.find((a) => a.skillPackId === skillId);
      if (activation) {
        activation.enabled = !activation.enabled;
        if (controlClient) await controlClient.saveSkillsState(snapshot.skills);
        showToast(t("skills.activationToggled", activation.enabled ? "技能已启用" : "技能已停用") + ": " + skillId, activation.enabled ? "success" : "info");
        controller?.render(snapshot);
      }
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-safety-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.safetyAction!;
      if (action === "deploy-workspace-rules" && snapshot.skills.workspaceRuleDeployments.length > 0) {
        snapshot.skills.workspaceRuleDeployments = snapshot.skills.workspaceRuleDeployments.map((d) => ({ ...d, status: "deployed" }));
        if (controlClient) await controlClient.saveSkillsState(snapshot.skills);
        controller?.render(snapshot);
      }
      showToast(t("skills.deployTriggered", "部署操作已触发") + ": " + action, "info");
    });
  });
}
