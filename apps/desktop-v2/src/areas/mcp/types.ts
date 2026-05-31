/**
 * MCP Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type { McpServerViewModel } from "../../types";

// ─── MCP Server Management ViewModel ───

export interface McpAreaViewModel {
  servers: McpServerViewModel[];
}
