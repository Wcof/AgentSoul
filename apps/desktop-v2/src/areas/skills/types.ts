/**
 * Skills Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type { SkillsAreaSnapshot } from "../../types";

// ─── Skills ViewModel ───

export interface SkillsViewModel extends SkillsAreaSnapshot {
  readonly areaKind: "Control Center Skills Area";
  deploymentSafetyAction: "deploy-workspace-rules";
}
