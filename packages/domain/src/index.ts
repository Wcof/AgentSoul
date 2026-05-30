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
export type ClientProtocol = "claude-messages" | "openai-chat" | "codex-responses" | "openai-images" | "gemini";
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

// ─── PAD Engine v2 类型 (Issue #67) ───

// Mehrabian 8 象限情绪标签
export type EmotionLabel =
  | "excited_confident"
  | "anxious_fearful"
  | "melancholic_sad"
  | "bored_passive"
  | "relaxed_content"
  | "angry_hostile"
  | "surprised_alert"
  | "neutral_calm";

export type DriftSeverity = "none" | "mild" | "moderate" | "severe";
export type PADEventType = "positive" | "negative" | "stress" | "surprise" | "conflict" | "neutral" | "custom";

export interface PADBaseline {
  pleasure: number;
  arousal: number;
  dominance: number;
}

export interface DriftReport {
  severity: DriftSeverity;
  distance: number;
  currentPAD: PADBaseline;
  baselinePAD: PADBaseline;
  reportedAt: string;
}

export interface EventPerturbation {
  eventType: PADEventType;
  intensity: number;
  pleasureShift: number;
  arousalShift: number;
  dominanceShift: number;
}

export interface EmotionSnapshot {
  id: string;
  pleasure: number;
  arousal: number;
  dominance: number;
  energy: number;
  emotionLabel: EmotionLabel;
  trigger: string;
  recordedAt: string;
}

// ─── Memory 类型 (Issue #68) ───

export type MemoryLayer = "day" | "week" | "month" | "year" | "topic";
export type MemoryPriority = "low" | "medium" | "high";

export interface MemoryEntry {
  id: string;
  layer: MemoryLayer;
  content: string;
  priority: MemoryPriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Entity 类型 (Issue #68) ───

export type EntityType = "person" | "hardware" | "project" | "concept" | "place" | "service";
export type FactConfidence = "high" | "medium" | "low";

export interface EntityFact {
  attribute: string;
  value: string;
  confidence: FactConfidence;
  source: string;
  updatedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  facts: EntityFact[];
  createdAt: string;
}

// ─── Semantic 类型 (Issue #68) ───

export interface SemanticMatch {
  memoryId: string;
  score: number;
  snippet: string;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  similarMemoryId: string | null;
  similarityScore: number;
}

// ─── Config + Health + Export + Locale 类型 (Issue #69) ───

export type Locale = "zh" | "en";

export interface PersonaSeed {
  name: string;
  role: string;
  personality: string[];
  coreValues: string[];
  interactionStyle: string;
  descriptionZh: string;
  descriptionEn: string;
}

export interface UserSeed {
  locale: Locale;
  personaSeed: PersonaSeed;
}

export type HealthStatus = "ok" | "warn" | "error";

export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  message: string;
}

export interface HealthReport {
  results: HealthCheckResult[];
  score: number; // 0-100
  checkedAt: string;
}

export interface CompanionshipMetric {
  name: string;
  value: number;
  threshold: number;
  status: HealthStatus;
}

export interface CompanionshipReport {
  metrics: CompanionshipMetric[];
  overallScore: number;
  evaluatedAt: string;
}

export type ExportKind = "portable" | "sensitive";

export interface ExportManifest {
  kind: ExportKind;
  includedSections: string[];
  excludedSections: string[];
  createdAt: string;
}
