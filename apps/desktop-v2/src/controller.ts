/**
 * Barrel file — re-exports all bind/controller functions for backward compatibility.
 * Original monolithic file split into area modules (Issue #114).
 */

// Shared shell controller
export { loadCompanionRuntimeSnapshot, mergeNativeCompanionRuntimeState } from "./shared/shell";

// Shared navigation
export { bindControlCenterNavigation } from "./shared/nav";

// Shared app switcher
export { bindAppSwitcherControls, bindUpdateDialogControls } from "./shared/app-switcher";

// Companion area
export { bindCompanionArea, bindInteractionControls, bindCompanionCustomization, bindDesktopPetWidgetControls } from "./areas/companion/bind";

// Gateway area
export { bindGatewayArea, bindChannelControls } from "./areas/gateway/bind";

// Costs area
export { bindCostsArea, bindChartControls } from "./areas/costs/bind";

// Skills area
export { bindSkillsArea, bindSkillControls } from "./areas/skills/bind";

// Sessions area
export { bindSessionsArea, bindSessionControls } from "./areas/sessions/bind";

// Shared utils (cross-area)
export { resolveSessionResumeFeedback } from "./shared/utils";

// Conversations area
export { bindConversationsArea, bindConversationDashboardControls } from "./areas/conversations/bind";

// Safety area
export { bindSafetyArea, bindApprovalControls, bindSafetyControls } from "./areas/safety/bind";

// Settings area
export { bindSettingsArea, bindLocaleToggle, bindPersonaSelection, bindDeepLinkImportControls } from "./areas/settings/bind";

// Settings-full area
export { bindSettingsFullArea, bindSettingsTabs, sanitizeImportedAppSettings } from "./areas/settings-full/bind";

// Sessions-mgr area
export { bindSessionsMgrArea } from "./areas/sessions-mgr/bind";

// MCP area
export { bindMcpArea, bindMcpControls } from "./areas/mcp/bind";

// Prompts area
export { bindPromptsArea, bindPromptControls } from "./areas/prompts/bind";

// Chat controller (TDD Slice 3)
export { sendMessage, toggleChatWindow, submitMessage } from "./chat-controller";

// Usage footer (shared)
export { bindUsageFooterControls } from "./shared/usage-footer";

// Backup controls (in settings-full)
export { bindBackupControls, bindWebdavControls } from "./shared/backup-controls";

// Main controller creation
export { createDesktopCompanionController } from "./shared/app-controller";
