/**
 * Safety Area — bind functions
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, DesktopApprovalDecisionKind, LocalControlClientLike } from "../../types";
import { t } from "../../shared/utils";
import { confirmDialog, showToast } from "../../utils/modal";

export function bindSafetyArea(ctx: AreaContext): void {
  bindApprovalControls(ctx.target, ctx.controller);
  bindSafetyControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
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

export function bindSafetyControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-approval-action][data-approval-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.approvalAction;
      const requestId = btn.dataset.approvalId!;
      if (!controlClient) { showToast(t("safety.notAvailable", "Safety management not available in local mode"), "info"); return; }
      const ok = action === "allow" ? await controlClient.approveRequest(requestId) : await controlClient.denyRequest(requestId);
      if (!ok) { showToast(t("safety.updateFailed", "安全审批更新失败"), "error"); return; }
      const req = snapshot.safety.approvalRequests.find((item) => item.id === requestId);
      if (req) req.status = action === "allow" ? "allowed" : "denied";
      showToast(action === "allow" ? t("safety.approved", "审批已同意") : t("safety.denied", "审批已拒绝"), "success");
      controller?.render(snapshot);
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-trust-revoke]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const grantId = btn.dataset.trustRevoke!;
      const confirmed = await confirmDialog(
        t("safety.confirmRevoke", "确认撤销"),
        t("safety.confirmRevokeMessage", "确定要撤销此信任授权吗？") + ` (${grantId})`,
        { confirmText: t("app.actions.revoke", "Revoke"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
      );
      if (confirmed) {
        if (controlClient) {
          const ok = await controlClient.revokeTrustGrant(grantId);
          if (ok) {
            showToast(t("safety.grantRevoked", "信任授权已撤销"), "success");
            const grant = snapshot.safety.scopedTrustGrants.find((g) => g.id === grantId);
            if (grant) grant.revokedAt = new Date().toISOString();
            controller?.render(snapshot);
          }
        } else {
          showToast(t("safety.notAvailable", "Safety management not available in local mode"), "info");
        }
      }
    });
  });
}
