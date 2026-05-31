/**
 * Safety Area — render functions
 */
import type { CompanionRuntimeSnapshot, DesktopApprovalRequest, DesktopRiskNotice } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderSafetyArea(snapshot: CompanionRuntimeSnapshot): string {
  const area = { areaKind: "Control Center Safety Area" as const, ...snapshot.safety };
  return `
    <section id="control-center-safety" class="control-center-area control-center-safety-area" data-control-area="safety" aria-label="Control Center Safety Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("safety.title", "Safety Area")}</p>
        <h2>${t("safety.approvalHistory", "Approval Requests")}</h2>
        <p>${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(t("safety.authMode." + area.clientAuthorizationMode, area.clientAuthorizationMode))}</p>
      </div>
      <section class="safety-list" aria-label="Approval Requests">
        ${area.approvalRequests.map((request) => `
          <article class="safety-row">
            <h3>${escapeHtml(request.status)}</h3>
            <p>${escapeHtml(request.title)} · ${escapeHtml(t("safety.riskClass." + request.actionRiskClass, request.actionRiskClass))} · ${escapeHtml(request.createdAt)}</p>
            <p>${escapeHtml(request.message)}</p>
            ${request.status === "Approval Required" ? `<div class="approval-actions"><button type="button" data-approval-action="allow" data-approval-id="${escapeHtml(request.id)}">${t("common.approve", "Allow")}</button><button type="button" data-approval-action="deny" data-approval-id="${escapeHtml(request.id)}">${t("common.deny", "Deny")}</button></div>` : ""}
          </article>
        `).join("")}
      </section>
      <section class="safety-list" aria-label="Risk Notices">
        <h3>${t("safety.riskNotices", "Risk Notices")}</h3>
        ${area.riskNotices.map((notice) => `
          <article class="safety-row">
            <p>${escapeHtml(notice.message)}</p>
            <p>${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(t("safety.authMode." + notice.clientAuthorizationMode, notice.clientAuthorizationMode))} · ${escapeHtml(notice.observedAt)}</p>
          </article>
        `).join("")}
      </section>
      <section class="safety-list" aria-label="Scoped Trust Grants">
        <h3>${t("safety.trustGrants", "Scoped Trust Grants")}</h3>
        ${area.scopedTrustGrants.map((grant) => `
          <article class="safety-row">
            <p>${escapeHtml(grant.id)} · ${escapeHtml(grant.actionKinds.join(", "))} · max ${escapeHtml(t("safety.riskClass." + grant.maxRiskClass, grant.maxRiskClass))}</p>
            <p>${grant.revokedAt ? `${t("safety.action.revokedAt", "revokedAt")}: ${escapeHtml(grant.revokedAt)}` : `${t("safety.action.expires", "expires")} ${escapeHtml(grant.expiresAt)}`}</p>
            <button type="button" data-trust-revoke="${escapeHtml(grant.id)}">${t("safety.revokeGrant", "Revoke Scoped Trust Grant")}</button>
          </article>
        `).join("")}
      </section>
      <section class="safety-list" aria-label="Action Risk Classes">
        <h3>${t("safety.actionRiskClasses", "Action Risk Classes")}</h3>
        ${area.actionRiskClasses.map((riskClass) => `<p>${escapeHtml(riskClass.actionKind)}: ${escapeHtml(t("safety.riskClass." + riskClass.riskClass, riskClass.riskClass))}</p>`).join("")}
      </section>
    </section>
  `;
}

export function renderApprovalRequired(pendingApproval?: DesktopApprovalRequest): string {
  if (!pendingApproval) return "";
  return `
    <section class="approval-required" aria-label="Approval Required">
      <p class="approval-risk">${escapeHtml(t("safety.riskClass." + pendingApproval.actionRiskClass, pendingApproval.actionRiskClass))}</p>
      <h2>${escapeHtml(pendingApproval.title)}</h2>
      <p>${escapeHtml(pendingApproval.message)}</p>
      <div class="approval-actions">
        <button type="button" data-approval-decision="allowed">${t("common.approve", "Allow")}</button>
        <button type="button" data-approval-decision="denied">${t("common.deny", "Deny")}</button>
      </div>
    </section>
  `;
}

export function renderRiskNotices(riskNotices: DesktopRiskNotice[]): string {
  if (riskNotices.length === 0) return "";
  return `
    <section class="risk-notices" aria-label="Risk Notice">
      <h2>${t("safety.riskNotices", "Risk Notice")}</h2>
      ${riskNotices.slice(-3).map((notice) => `
        <article class="risk-notice">
          <p>${escapeHtml(notice.message)}</p>
          <p class="risk-mode">${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(notice.clientAuthorizationMode)}</p>
        </article>
      `).join("")}
    </section>
  `;
}
