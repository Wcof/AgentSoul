/**
 * Conversations Area — render functions
 */
import type { CompanionRuntimeSnapshot, ConversationDashboardSnapshot, ConversationInfo, ConversationKind, ConversationStatus } from "../../types";
import { t, escapeHtml } from "../../shared/utils";

export function renderConversationsArea(snapshot: CompanionRuntimeSnapshot): string {
  return `
    <section id="control-center-conversations" class="control-center-area" data-control-area="conversations" aria-label="Conversations">
      ${renderConversationDashboard(snapshot.conversationDashboard)}
    </section>
  `;
}

export function renderConversationDashboard(dashboard: ConversationDashboardSnapshot): string {
  const kindFilters: Array<{ value: ConversationKind | ""; label: string; color: string }> = [
    { value: "", label: t("cockpit.filter.all", "全部"), color: "var(--text-primary)" },
    { value: "messages", label: t("cockpit.filter.messages", "消息"), color: "var(--accent-purple)" },
    { value: "chat", label: t("cockpit.filter.chat", "对话"), color: "var(--accent-blue)" },
    { value: "images", label: t("cockpit.filter.images", "图像"), color: "var(--accent-pink)" },
    { value: "responses", label: t("cockpit.filter.responses", "响应"), color: "var(--accent-cyan)" },
    { value: "gemini", label: t("cockpit.filter.gemini", "Gemini"), color: "var(--accent-orange)" },
  ];

  const filtered = dashboard.conversations.filter((c) => {
    if (dashboard.activeFilter && c.kind !== dashboard.activeFilter) return false;
    if (dashboard.searchQuery) {
      const q = dashboard.searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.channelName?.toLowerCase().includes(q);
    }
    return true;
  });

  return `
    <div class="conversation-dashboard" data-control-area="conversations">
      <div class="dashboard-header">
        <div class="kind-filter-chips">
          ${kindFilters.map((f) => `<button type="button" class="kind-chip ${dashboard.activeFilter === f.value ? 'kind-chip--active' : ''}" data-kind-filter="${f.value}" style="--chip-color: ${f.color}">${escapeHtml(f.label)}</button>`).join("")}
        </div>
        <div class="dashboard-search">
          <input type="search" data-conversation-search value="${escapeHtml(dashboard.searchQuery)}" placeholder="${t('cockpit.searchPlaceholder', 'Search conversations...')}" class="search-input" />
        </div>
        <div class="system-status">
          <span class="status-dot status-dot--${dashboard.systemStatus}"></span>
          <span>${escapeHtml(t("cockpit.status." + dashboard.systemStatus, dashboard.systemStatus))}</span>
          <span class="active-count">${t('cockpit.active', 'Active')}: ${filtered.length}</span>
          ${dashboard.overrideCount > 0 ? `<span class="override-count">${t('cockpit.override', 'Override')}: ${dashboard.overrideCount}</span>` : ''}
        </div>
      </div>
      ${filtered.length === 0 ? `<div class="empty-state"><div class="empty-icon">💬</div><p>${t('cockpit.empty', 'No active conversations')}</p></div>` : `<div class="conversation-grid">${filtered.map((conv) => renderConversationCard(conv)).join("")}</div>`}
    </div>
  `;
}

function renderConversationCard(conv: ConversationInfo): string {
  const statusColors: Record<ConversationStatus, string> = { active: "var(--accent-green)", idle: "var(--accent-gold)", completed: "var(--text-muted)", error: "var(--accent-red)" };
  const kindIcons: Record<ConversationKind, string> = { messages: "💬", chat: "🗨️", images: "🖼️", responses: "📝", gemini: "✨" };

  return `
    <article class="conversation-card" data-conversation-id="${escapeHtml(conv.id)}">
      <div class="conversation-card-header">
        <span class="conversation-kind-icon">${kindIcons[conv.kind]}</span>
        <span class="conversation-kind-badge" style="color: ${statusColors[conv.status]}">${escapeHtml(t("cockpit.kind." + conv.kind, conv.kind))}</span>
        <span class="conversation-status-dot" style="background: ${statusColors[conv.status]}"></span>
      </div>
      <h4 class="conversation-title">${escapeHtml(conv.title)}</h4>
      ${conv.channelName ? `<p class="conversation-channel">${escapeHtml(conv.channelName)}</p>` : ''}
      <div class="conversation-meta">
        <span class="conversation-messages">💬 ${conv.messageCount}</span>
        ${conv.model ? `<span class="conversation-model">🤖 ${escapeHtml(conv.model)}</span>` : ''}
        ${conv.estimatedCost ? `<span class="conversation-cost">💰 $${conv.estimatedCost.toFixed(4)}</span>` : ''}
      </div>
      <div class="conversation-time"><span>${escapeHtml(conv.lastActivityAt)}</span></div>
    </article>
  `;
}
