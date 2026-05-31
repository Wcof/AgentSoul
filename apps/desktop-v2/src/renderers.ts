/**
 * Barrel file — re-exports all render functions for backward compatibility.
 * Original monolithic file split into area modules (Issue #114).
 */

// Shared utilities
export { t, resolveVisualState, faceForState, labelForInteraction, formatMix, escapeHtml, formatNumber, formatBytes, errorMessage } from "./shared/utils";

// Default snapshot
export { defaultCompanionSnapshot } from "./data/defaultSnapshot";

// Shared shell
export { renderAgentSoulShell, renderDesktopCompanionWidget } from "./shared/shell";

// Shared navigation
export { renderControlCenterTaskNavigation } from "./shared/nav";

// Shared app switcher
export { renderAppSwitcher, renderUpdateDialog } from "./shared/app-switcher";

// Companion area
export { renderCompanionArea, renderCompanionViewModel } from "./areas/companion/render";

// Gateway area
export { renderGatewayArea, renderActivityWaveform, renderChannelLogsDialog, renderCapabilityTestDialog, renderGlobalStatsChart } from "./areas/gateway/render";

// Shared components (cross-area)
export { renderDashboardStatsBar } from "./shared/components";

// Costs area
export { renderCostsArea, renderKeyTrendChart, renderModelStatsChart } from "./areas/costs/render";

// Skills area
export { renderSkillsArea } from "./areas/skills/render";

// Sessions area
export { renderSessionsArea } from "./areas/sessions/render";

// Conversations area
export { renderConversationsArea, renderConversationDashboard } from "./areas/conversations/render";

// Safety area
export { renderSafetyArea, renderApprovalRequired, renderRiskNotices } from "./areas/safety/render";

// Settings area
export { renderSettingsArea, renderDeepLinkImportDialog } from "./areas/settings/render";

// Settings-full area
export { renderSettingsFullArea, renderFullSettingsArea } from "./areas/settings-full/render";

// Sessions-mgr area
export { renderSessionsMgrArea } from "./areas/sessions-mgr/render";

// MCP area
export { renderMcpArea } from "./areas/mcp/render";

// Prompts area
export { renderPromptsArea } from "./areas/prompts/render";

// Chat renderer (TDD Slice 3)
export { renderChatWindow } from "./chat-renderer";

// Backward compat aliases for ViewModel functions that tests may reference
export { renderCompanionViewModel as renderControlCenterCompanionAreaViewModel } from "./areas/companion/render";
export { renderGatewayArea as renderControlCenterGatewayAreaViewModel } from "./areas/gateway/render";
export { renderCostsArea as renderControlCenterCostsAreaViewModel } from "./areas/costs/render";
export { renderSkillsArea as renderControlCenterSkillsAreaViewModel } from "./areas/skills/render";
export { renderSessionsArea as renderControlCenterSessionsAreaViewModel } from "./areas/sessions/render";
export { renderSafetyArea as renderControlCenterSafetyAreaViewModel } from "./areas/safety/render";
export { renderSettingsArea as renderControlCenterSettingsAreaViewModel } from "./areas/settings/render";

// Area render functions (for areas array)
export { renderCompanionArea as renderControlCenterCompanionArea } from "./areas/companion/render";
export { renderGatewayArea as renderControlCenterGatewayArea } from "./areas/gateway/render";
export { renderCostsArea as renderControlCenterCostsArea } from "./areas/costs/render";
export { renderSkillsArea as renderControlCenterSkillsArea } from "./areas/skills/render";
export { renderSessionsArea as renderControlCenterSessionsArea } from "./areas/sessions/render";
export { renderSafetyArea as renderControlCenterSafetyArea } from "./areas/safety/render";
export { renderSettingsArea as renderControlCenterSettingsArea } from "./areas/settings/render";
