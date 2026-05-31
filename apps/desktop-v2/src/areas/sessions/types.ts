/**
 * Sessions Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type { SessionsAreaSnapshot } from "../../types";

// ─── Sessions ViewModel ───

export interface SessionsViewModel extends SessionsAreaSnapshot {
  readonly areaKind: "Control Center Sessions Area";
  searchLabel: "Work Session search";
  launcherLabel: "safety-gated Session Launcher";
  launchSafetyAction: "launch-session";
}
