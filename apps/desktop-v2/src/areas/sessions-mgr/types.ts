/**
 * Sessions-Mgr Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type { SessionListItemViewModel } from "../../types";

// ─── Session Manager ViewModel ───

export interface SessionsMgrViewModel {
  sessions: SessionListItemViewModel[];
}
