/**
 * Companion Area — ViewModel types
 * Derived from @agentsoul/domain types for type-safe UI rendering.
 */

import type {
  Companion,
  CompanionVitals,
  PetAppearance,
  Mood,
  EmotionLabel,
} from "@agentsoul/domain";

// ─── Vital Display ───

export interface VitalDisplay {
  label: string;
  value: string;
}

// ─── Customization ViewModel ───

export interface KindOption {
  kind: string;
  label: string;
  labelZh: string;
}

export interface SkinOption {
  kind: string;
  skin: string;
  label: string;
  labelZh: string;
}

export interface CustomizationViewModel {
  displayName: string;
  currentKind: string;
  currentSkin: string;
  availableKinds: KindOption[];
  availableSkins: SkinOption[];
}

// ─── Growth Event ViewModel ───

export interface GrowthEventViewModel {
  description: string;
  sourceType: string;
  xpDelta: number;
  occurredAt: string;
}

// ─── Companion ViewModel ───

export interface CompanionViewModel {
  readonly viewModelKind: "Companion appearance view model";
  identity: string;
  name: string;
  appearanceLabel: string;
  visualState: string;
  providerRouteLabel: string;
  vitals: VitalDisplay[];
  customization: CustomizationViewModel;
  growthHistory: GrowthEventViewModel[];
  pendingApproval: unknown | null;
  riskNotices: unknown[];
  controlCenterCompanionArea: { areaKind: string };
  controlCenterGatewayArea: { areaKind: string };
  controlCenterCostsArea: { areaKind: string };
  controlCenterSkillsArea: { areaKind: string };
  controlCenterSessionsArea: { areaKind: string };
  controlCenterSafetyArea: { areaKind: string };
  controlCenterSettingsArea: { areaKind: string };
}
