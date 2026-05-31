/**
 * Prompts Area — render functions
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderPromptsArea(snapshot: CompanionRuntimeSnapshot): string {
  const prompts = snapshot.prompts || [];
  return `
    <section id="control-center-prompts" class="control-center-area" data-control-area="prompts" aria-label="Prompt Management">
      <div class="control-area-header">
        <p class="eyebrow">${t("prompts.title", "Prompt Templates")}</p>
        <h2>${t("prompts.subtitle", "Reusable Prompt Library")}</h2>
        <div class="channel-orchestration-actions"><button type="button" data-prompt-add class="channel-action-btn">${t("prompt.addPrompt", "Add Prompt")}</button></div>
      </div>
      <div class="prompt-list" role="list">
        ${prompts.length === 0 ? `<div class="empty-state"><p>${t("prompt.noPrompts", "No prompt templates")}</p></div>` : ''}
        ${prompts.map((p) => `
          <article class="prompt-card${p.isFavorite ? " prompt-card--favorite" : ""}" role="listitem" data-prompt-id="${escapeHtml(p.id)}">
            <div class="prompt-card-header">
              <h4>${escapeHtml(p.nameZh || p.name)}</h4>
              ${p.category ? '<span class="prompt-category">' + escapeHtml(p.category) + '</span>' : ''}
              <button type="button" data-prompt-favorite="${escapeHtml(p.id)}" class="prompt-fav-btn">${p.isFavorite ? "&#9733;" : "&#9734;"}</button>
              <button type="button" data-prompt-delete="${escapeHtml(p.id)}" class="prompt-fav-btn" style="color:var(--accent-red)">&#128465;</button>
            </div>
            <p class="prompt-content">${escapeHtml(p.content.slice(0, 120))}${p.content.length > 120 ? "..." : ""}</p>
            ${p.tags ? '<div class="prompt-tags">' + p.tags.map((tag) => '<span class="trait-tag">' + escapeHtml(tag) + '</span>').join("") + '</div>' : ''}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
