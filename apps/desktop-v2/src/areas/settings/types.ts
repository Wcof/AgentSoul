/**
 * Settings Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type {
  SettingsAreaSnapshot,
  PersonaTemplateSnapshot,
  CompanionCustomizationSnapshot,
  DeepLinkImportSnapshot,
} from "../../types";

// ─── Settings ViewModel ───

export interface SettingsViewModel extends SettingsAreaSnapshot {
  readonly areaKind: "Control Center Settings Area";
  personaTemplates: PersonaTemplateSnapshot[];
  customization: CompanionCustomizationSnapshot;
}

// ─── Deep Link Import ViewModel ───

export type { DeepLinkImportSnapshot };
