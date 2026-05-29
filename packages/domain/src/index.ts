type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type CompanionId = Brand<string, "CompanionId">;
export type SoulId = Brand<string, "SoulId">;
export type ProviderProfileId = Brand<string, "ProviderProfileId">;
export type CredentialRef = Brand<string, "CredentialRef">;
export type SkillPackId = Brand<string, "SkillPackId">;
export type WorkSessionId = Brand<string, "WorkSessionId">;

export type CompanionEnergy = Brand<number, "CompanionEnergy">;
export type AffectiveEnergy = Brand<number, "AffectiveEnergy">;
export type Intimacy = Brand<number, "Intimacy">;
export type MoodValue = "positive" | "neutral" | "negative" | "fatigued" | "sleeping";
export type Mood = Brand<MoodValue, "Mood">;

export type PetAppearanceKind = "slime" | "cat" | "custom";
export type ProviderActivationMode = "gateway-route" | "direct-client-config";
export type ClientProtocol = "claude-messages" | "openai-chat" | "codex-responses" | "gemini";
export type ProviderProtocol = "anthropic" | "openai-chat" | "openai-responses" | "gemini";
export type ClientAuthorizationMode = "normal" | "elevated" | "fully-authorized";
export type ActionRiskClass = "safe" | "sensitive" | "high-risk" | "critical";
export type ApprovalDecisionKind = "allowed" | "denied" | "timeout-denied" | "unavailable-denied";

export interface PetAppearance {
  kind: PetAppearanceKind;
  skin: string;
  outfit?: string;
  animationStyle?: string;
}

export interface CompanionVitals {
  level: number;
  xp: number;
  companionEnergy: CompanionEnergy;
  hunger: number;
  intimacy: Intimacy;
}

export interface Companion {
  id: string;
  displayName: string;
  soulId: string;
  petAppearance: PetAppearance;
  vitals: CompanionVitals;
  mood: Mood;
}

export interface AffectiveState {
  pleasure: number;
  arousal: number;
  dominance: number;
  affectiveEnergy: AffectiveEnergy;
}

export interface Soul {
  id: SoulId | string;
  personaName: string;
  affectiveState: AffectiveState;
}

export interface ProviderProfile {
  id: ProviderProfileId | string;
  name: string;
  activationMode: ProviderActivationMode;
  credentialRef?: CredentialRef | string;
  clientProtocol: ClientProtocol;
  providerProtocol: ProviderProtocol;
  targetModel: string;
  endpoint: string;
}

export interface ApprovalRequest {
  id: string;
  actionRiskClass: ActionRiskClass;
  title: string;
  message: string;
  createdAt: string;
}

export interface ApprovalDecision {
  requestId: string;
  kind: ApprovalDecisionKind;
  decidedAt: string;
}

export interface RiskNotice {
  id: string;
  message: string;
  observedAt: string;
  clientAuthorizationMode: ClientAuthorizationMode;
}

export interface SkillPack {
  id: SkillPackId | string;
  name: string;
  source: string;
  installedAt: string;
}

export interface WorkSession {
  id: WorkSessionId | string;
  source: string;
  projectPath: string;
  searchable: boolean;
  resumable: boolean;
  lastActiveAt: string;
  resumeCommand?: string;
}

export function createCompanionEnergy(value: number): CompanionEnergy {
  return clamp(value, 0, 100) as CompanionEnergy;
}

export function createAffectiveEnergy(value: number): AffectiveEnergy {
  return clamp(value, -1, 1) as AffectiveEnergy;
}

export function createIntimacy(value: number): Intimacy {
  return clamp(value, 0, 100) as Intimacy;
}

export function createMood(value: MoodValue): Mood {
  return value as Mood;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
