/**
 * Safety Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type {
  SafetyAreaSnapshot,
  DesktopApprovalRequest,
  DesktopRiskNotice,
} from "../../types";

// ─── Approval Request Display ───

export type { DesktopApprovalRequest, DesktopRiskNotice };

// ─── Safety ViewModel ───

export interface SafetyViewModel extends SafetyAreaSnapshot {
  readonly areaKind: "Control Center Safety Area";
}
