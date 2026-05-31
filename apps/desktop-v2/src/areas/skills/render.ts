/**
 * Skills Area — render functions
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderSkillsArea(snapshot: CompanionRuntimeSnapshot): string {
  const area = { areaKind: "Control Center Skills Area" as const, deploymentSafetyAction: "deploy-workspace-rules" as const, ...snapshot.skills };
  return `
    <section id="control-center-skills" class="control-center-area control-center-skills-area" data-control-area="skills" aria-label="Control Center Skills Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("skills.title", "Skills Area")}</p>
        <h2>${t("skills.installed", "Skill Installation")}</h2>
        <p>${t("skills.projectActivationFor", "Project Skill Activation for")} ${escapeHtml(area.projectPath)}</p>
      </div>
      <section class="skills-list" aria-label="Installed Skill Packs">
        ${area.installedSkillPacks.map((skill) => `
          <article class="skill-row">
            <h3>${escapeHtml(skill.name)}</h3>
            <p>${escapeHtml(skill.source)} · ${t("skills.installedLabel", "installed")} ${escapeHtml(skill.installedAt)}</p>
            <button type="button" data-skill-activation="${escapeHtml(skill.id)}">${t("skills.toggleActivation", "Toggle Project Skill Activation")}</button>
          </article>
        `).join("")}
      </section>
      <section class="skills-list" aria-label="Project Skill Activation">
        <h3>${t("skills.projectActivation", "Project Skill Activation")}</h3>
        ${area.projectActivations.map((activation) => `
          <p>${escapeHtml(activation.skillPackId)}: ${activation.enabled ? t("common.enabled", "enabled") : t("common.disabled", "disabled")} ${t("skills.via", "via")} ${escapeHtml(t("skills.source." + activation.source, activation.source))}</p>
        `).join("")}
      </section>
      <section class="skills-list" aria-label="Workspace Rule Deployment">
        <h3>${t("skills.ruleDeployment", "Workspace Rule Deployment")}</h3>
        <p>${t("skills.safetyPolicyState", "Safety Policy state")}: ${escapeHtml(area.deploymentSafetyAction)}</p>
        ${area.workspaceRuleDeployments.map((deployment) => `
          <article class="skill-row">
            <p>${escapeHtml(deployment.skillPackId)} ${t("skills.deployment", "deployment")}: ${escapeHtml(t("skills.status." + deployment.status, deployment.status))}</p>
            <button type="button" data-safety-action="${area.deploymentSafetyAction}">${t("skills.deployRules", "Deploy Workspace Rules")}</button>
            ${deployment.managedRuleFiles.map((file) => `<p>${t("skills.managedFile", "Managed Rule File")}: ${escapeHtml(file.targetPath)} (${escapeHtml(t("skills.method." + file.method, file.method))})</p>`).join("")}
          </article>
        `).join("")}
      </section>
    </section>
  `;
}
