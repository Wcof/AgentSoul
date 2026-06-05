import type { MasterModel } from "@agentsoul/companion/soul";

export type CompanionVisualState = "idle" | "positive" | "fatigue" | "sleep" | "attention";
export type CompanionInteractionKind = "feed" | "play" | "pet" | "sleep";
export type CompanionInteractionOutcome = "applied" | "blocked-low-energy";

export type CompanionActivityState =
  | "idle"
  | "blink"
  | "attention"
  | "happy"
  | "sleep"
  | "degraded";

export type CompanionQuickAction =
  | "refresh-runtime"
  | "hide-companion"
  | "show-status";

export type UserPresenceState = "ACTIVE" | "PRESENT" | "IDLE" | "AWAY" | "OFFLINE";
export type CompanionMode = "AUTONOMOUS" | "CONVERSING" | "THINKING" | "QUEUING" | "SLEEPING" | "INTRUDING";
export type CompanionEventPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CompanionOutputStrategy = "silent" | "queue" | "express" | "interrupt";

export type PetKind = "slime" | "cat" | "custom";
export type PetSkin = "default" | "tabby" | "black" | "calico" | "night" | "sakura";
export type PetStateName = "idle" | "blink" | "happy" | "attention" | "sleep" | "degraded";

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameSequence {
  frames?: number[];
  rects?: FrameRect[];
  loop: boolean;
  fps?: number;
}

export interface PetAssetPackManifest {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
  spritesheetDataUrl?: string;
  kind: string;
  version?: string;
  frame?: {
    width: number;
    height: number;
    count?: number;
  };
  states?: Partial<Record<PetStateName, FrameSequence>>;
  fps?: number;
  chromaKey?: string;
  anchor?: {
    x: number;
    y: number;
  };
}

export interface AssetValidationSnapshot {
  level: "ok" | "warning" | "error";
  messages: string[];
}

export interface PetAppearanceSnapshot {
  kind: PetKind;
  skin: string;
  outfit?: string;
  animationStyle?: string;
  assetPackId?: string;
  assetPackPath?: string;
  displayName?: string;
  spritesheetPath?: string;
  spritesheetDataUrl?: string;
  assetPackVersion?: string;
  assetValidation?: AssetValidationSnapshot;
  assetManifest?: PetAssetPackManifest;
}

export interface CompanionAutonomySnapshot {
  userPresence: UserPresenceState;
  companionMode: CompanionMode;
  lastEventPriority?: CompanionEventPriority;
  lastOutputStrategy?: CompanionOutputStrategy;
  queuedOutputCount: number;
  lastAction?: string;
  cooldownUntil?: string;
}

export type CompanionMasterModelObservation = MasterModel["learningState"]["observations"][number];

export interface DesktopBodyMasterModelObservation {
  id: string;
  stage: "observation" | "hypothesis" | "verification" | "solidified";
  source: "conversation" | "interaction" | "manual";
  claim: string;
  evidence: string[];
  confidence: number;
  updatedAt: string;
}

export type CompanionMasterModelSnapshot = MasterModel;

export interface DesktopCompanionSnapshot {
  id: string;
  displayName: string;
  soulId: string;
  petAppearance: PetAppearanceSnapshot;
  mood: "positive" | "neutral" | "negative" | "fatigued" | "sleeping";
  vitals: {
    level: number;
    xp: number;
    companionEnergy: number;
    hunger: number;
    intimacy: number;
  };
  activityState?: CompanionActivityState;
  healthState?: "healthy" | "attention" | "degraded";
  summary?: string;
  availableQuickActions?: CompanionQuickAction[];
  lastUpdatedAt?: string;
  autonomy?: CompanionAutonomySnapshot;
  masterModel?: CompanionMasterModelSnapshot;
}

export interface ProviderProfileSnapshot {
  id: string;
  name: string;
}

export interface CompanionCustomizationSnapshot {
  availableKinds: Array<{ kind: PetKind; label: string; labelZh: string }>;
  availableSkins: Array<{ skin: PetSkin; label: string; labelZh: string; kind: PetKind }>;
  currentKind: PetKind;
  currentSkin: PetSkin;
  currentOutfit?: string;
  displayName: string;
}

export interface DesktopBodySnapshot {
  companion: DesktopCompanionSnapshot;
  providerProfile: ProviderProfileSnapshot;
  desktopPreferences?: {
    language: "zh" | "en";
  };
  companionCustomization?: CompanionCustomizationSnapshot;
}

export interface CompanionInteractionResult<TSnapshot extends DesktopBodySnapshot = DesktopBodySnapshot> {
  outcome: CompanionInteractionOutcome;
  state: TSnapshot;
}

export interface NativeCompanionRuntimeState {
  companion?: Partial<DesktopBodySnapshot["companion"]>;
  providerProfile?: Partial<DesktopBodySnapshot["providerProfile"]>;
  desktopPreferences?: Partial<DesktopBodySnapshot["desktopPreferences"]>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  emotion?: string;
}

export interface ChatSession {
  id: string;
  companionId: string;
  messages: ChatMessage[];
  startedAt: string;
  lastMessageAt: string;
}
