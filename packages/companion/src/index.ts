import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  AffectiveState,
  Companion,
  CompanionVitals,
  Mood,
  PetAppearance,
  ProviderProfile,
  Soul,
} from "@agentsoul/domain";
import {
  createAffectiveEnergy,
  createCompanionEnergy,
  createIntimacy,
  createMood,
} from "@agentsoul/domain";
import { initializeV2Database } from "@agentsoul/persistence";
import { CompanionStateRepository } from "./companion-repository.js";

const DEFAULT_COMPANION_ID = "active-companion";
const DEFAULT_SOUL_ID = "default-soul";
const DEFAULT_PROVIDER_PROFILE_ID = "default-provider-profile";
const GROWTH_RULE_VERSION = "companion-interactions-v1";
const GATEWAY_GROWTH_RULE_VERSION = "gateway-traffic-v1";
const DEFAULT_GROWTH_PROFILE_VERSION = GATEWAY_GROWTH_RULE_VERSION;
const HUNGER_DECAY_PER_HOUR = 1;
const HUNGER_OFFLINE_DECAY_CAP = 20;
const CLOCK_ANOMALY_HOURS = 24 * 14;
const REST_RECOVERY_PER_HOUR = 3;
const REST_RECOVERY_CAP = 40;

export type CompanionInteractionKind = "feed" | "play" | "pet" | "sleep";
export type CompanionInteractionOutcome = "applied" | "blocked-low-energy";
export type WorkGrowthOutcome = "applied" | "fatigued-dampened";
export type GatewayTrafficGrowthOutcome = "applied" | "fatigued-dampened" | "failed-no-xp";

export interface CompanionRuntimeOptions {
  dbPath: string;
  clock?: () => Date;
}

export interface CompanionRuntimeState {
  companion: Companion;
  soul: Soul;
  providerProfile: ProviderProfile;
  growthProfile: GrowthProfile;
  derivedVitals?: {
    hungerBaseline: number;
    hungerBaselineAt: string;
    companionEnergyBaseline?: number;
    companionEnergyBaselineAt?: string;
  };
}

export interface GrowthProfile {
  id: string;
  name: string;
  version: string;
  xpMultiplier: number;
  energyCostMultiplier: number;
  fatigueThreshold: number;
  xpDampeningMultiplier: number;
  maxXpPerEvent: number;
  maxEnergyCostPerEvent: number;
}

export interface GrowthEvent {
  id: string;
  companionId: string;
  interaction: CompanionInteractionKind;
  outcome: CompanionInteractionOutcome | GatewayTrafficGrowthOutcome;
  sourceType: "direct-interaction" | "gateway-event";
  sourceId: string;
  growthRuleVersion: string;
  before: CompanionVitals;
  after: CompanionVitals;
  mood: Mood;
  occurredAt: string;
}

export interface CompanionInteractionResult {
  outcome: CompanionInteractionOutcome;
  state: CompanionRuntimeState;
  event: GrowthEvent;
}

export interface WorkGrowthResult {
  outcome: WorkGrowthOutcome;
  state: CompanionRuntimeState;
  event: GrowthEvent;
}

export interface GatewayTrafficGrowthResult {
  outcome: GatewayTrafficGrowthOutcome;
  state: CompanionRuntimeState;
  event: GrowthEvent;
}

export interface CompanionRuntimeService {
  getCompanionRuntimeState(): CompanionRuntimeState;
  updateCompanionVitalsAndMood(update: {
    vitals?: Partial<{
      level: number;
      xp: number;
      companionEnergy: number;
      hunger: number;
      intimacy: number;
    }>;
    mood?: Mood;
  }): CompanionRuntimeState;
  updatePetAppearance(petAppearance: PetAppearance): CompanionRuntimeState;
  performCompanionInteraction(kind: CompanionInteractionKind): CompanionInteractionResult;
  applyWorkGrowth(input: { tokenCount: number; sourceId?: string }): WorkGrowthResult;
  applyGatewayTrafficGrowth(input: {
    gatewayEventId: string;
    outcome: string;
    inputTokens: number;
    outputTokens: number;
  }): GatewayTrafficGrowthResult;
  updateGrowthProfile(update: Partial<Omit<GrowthProfile, "id">> & { id?: string }): CompanionRuntimeState;
  applyRestRecovery(): CompanionRuntimeState;
  updateSoulAffectiveState(affectiveState: {
    pleasure: number;
    arousal: number;
    dominance: number;
    affectiveEnergy: number;
  }): CompanionRuntimeState;
  updateSoulPersona(update: { personaName: string }): CompanionRuntimeState;
  listGrowthEvents(): GrowthEvent[];
  close(): void;
}

export function createCompanionRuntime(options: CompanionRuntimeOptions): CompanionRuntimeService {
  initializeV2Database(options.dbPath);

  const db = new Database(options.dbPath);
  const repo = new CompanionStateRepository(db);
  const clock = options.clock ?? (() => new Date());
  ensureDefaultState(repo, clock);

  return {
    getCompanionRuntimeState() {
      return readRuntimeState(repo, clock);
    },
    updateCompanionVitalsAndMood(update) {
      const state = readRuntimeState(repo, clock);

      const nextVitals = {
        ...state.companion.vitals,
        ...normalizeVitalsPatch(update.vitals),
      };
      const nextState = {
        ...state,
        companion: {
          ...state.companion,
          vitals: nextVitals,
          mood: update.mood ?? state.companion.mood,
        },
      };

      writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
      return nextState;
    },
    updatePetAppearance(petAppearance) {
      const state = readRuntimeState(repo, clock);
      const nextState = {
        ...state,
        companion: {
          ...state.companion,
          petAppearance,
        },
      };

      writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
      return nextState;
    },
    performCompanionInteraction(kind) {
      return performCompanionInteraction(repo, kind, clock);
    },
    applyWorkGrowth(input) {
      return applyWorkGrowth(repo, input, clock);
    },
    applyGatewayTrafficGrowth(input) {
      return applyGatewayTrafficGrowth(repo, input, clock);
    },
    updateGrowthProfile(update) {
      const state = readRuntimeState(repo, clock);
      const nextState = {
        ...state,
        growthProfile: normalizeGrowthProfile({
          ...state.growthProfile,
          ...update,
        }),
      };

      writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
      return nextState;
    },
    applyRestRecovery() {
      return applyRestRecovery(repo, clock);
    },
    updateSoulAffectiveState(affectiveState) {
      const state = readRuntimeState(repo, clock);
      const nextState = {
        ...state,
        soul: {
          ...state.soul,
          affectiveState: normalizeAffectiveState(affectiveState),
        },
      };

      writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
      return nextState;
    },
    updateSoulPersona(update) {
      const state = readRuntimeState(repo, clock);
      const nextState = {
        ...state,
        soul: {
          ...state.soul,
          personaName: update.personaName,
        },
      };

      writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
      return nextState;
    },
    listGrowthEvents() {
      return listGrowthEvents(repo);
    },
    close() {
      db.close();
    },
  };
}

function ensureDefaultState(repo: CompanionStateRepository, clock: () => Date): void {
  repo.ensureDefault(DEFAULT_COMPANION_ID, JSON.stringify(createDefaultRuntimeState(clock)));
}

function readRuntimeState(repo: CompanionStateRepository, clock: () => Date): CompanionRuntimeState {
  const row = repo.read(DEFAULT_COMPANION_ID);

  if (!row) {
    const state = createDefaultRuntimeState(clock);
    writeRuntimeState(repo, state);
    return state;
  }

  return applyDerivedVitals(withDefaultGrowthProfile(JSON.parse(row) as CompanionRuntimeState), clock);
}

function writeRuntimeState(repo: CompanionStateRepository, state: CompanionRuntimeState): void {
  repo.write(state.companion.id, JSON.stringify(state));
}

function performCompanionInteraction(
  repo: CompanionStateRepository,
  kind: CompanionInteractionKind,
  clock: () => Date,
): CompanionInteractionResult {
  const state = readRuntimeState(repo, clock);
  const before = state.companion.vitals;
  const { outcome, vitals, mood } = applyInteraction(kind, before);
  const nextState = {
    ...state,
    companion: {
      ...state.companion,
      vitals,
      mood,
    },
  };
  const event = createGrowthEvent({
    companionId: state.companion.id,
    interaction: kind,
    outcome,
    before,
    after: vitals,
    mood,
  });

  repo.runTransaction(() => {
    writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
    writeGrowthEvent(repo, event);
  });

  return {
    outcome,
    state: nextState,
    event,
  };
}

function applyWorkGrowth(
  repo: CompanionStateRepository,
  input: { tokenCount: number; sourceId?: string },
  clock: () => Date,
): WorkGrowthResult {
  const state = readRuntimeState(repo, clock);
  const before = state.companion.vitals;
  const profile = state.growthProfile;
  const baseXp = calculateXpGain(input.tokenCount, profile);
  const energyCost = calculateEnergyCost(input.tokenCount, profile, "floor");
  const fatigued = before.companionEnergy < profile.fatigueThreshold;
  const xpGain = applyXpDampening(baseXp, fatigued, profile);
  const vitals = {
    ...before,
    xp: before.xp + xpGain,
    companionEnergy: createCompanionEnergy(before.companionEnergy - energyCost),
  };
  const mood = fatigued ? createMood("fatigued") : state.companion.mood;
  const nextState = {
    ...state,
    companion: {
      ...state.companion,
      vitals,
      mood,
    },
  };
  const event = createGrowthEvent({
    companionId: state.companion.id,
    interaction: "play",
    outcome: fatigued ? "blocked-low-energy" : "applied",
    before,
    after: vitals,
    mood,
    growthRuleVersion: profile.version,
  });

  repo.runTransaction(() => {
    writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
    writeGrowthEvent(repo, {
      ...event,
      outcome: fatigued ? "blocked-low-energy" : "applied",
    });
  });

  return {
    outcome: fatigued ? "fatigued-dampened" : "applied",
    state: nextState,
    event,
  };
}

function applyGatewayTrafficGrowth(
  repo: CompanionStateRepository,
  input: {
    gatewayEventId: string;
    outcome: string;
    inputTokens: number;
    outputTokens: number;
  },
  clock: () => Date,
): GatewayTrafficGrowthResult {
  const state = readRuntimeState(repo, clock);
  const before = state.companion.vitals;
  const profile = state.growthProfile;
  const totalTokens = normalizeTokenCount(input.inputTokens) + normalizeTokenCount(input.outputTokens);
  const successful = input.outcome === "translated";
  const fatigued = before.companionEnergy < profile.fatigueThreshold;
  const baseXp = successful ? calculateXpGain(totalTokens, profile) : 0;
  const xpGain = applyXpDampening(baseXp, fatigued, profile);
  const energyCost = calculateEnergyCost(totalTokens, profile, "ceil");
  const outcome: GatewayTrafficGrowthOutcome = successful
    ? fatigued
      ? "fatigued-dampened"
      : "applied"
    : "failed-no-xp";
  const vitals = {
    ...before,
    xp: before.xp + xpGain,
    companionEnergy: createCompanionEnergy(before.companionEnergy - energyCost),
  };
  const mood = vitals.companionEnergy < 20 ? createMood("fatigued") : state.companion.mood;
  const nextState = {
    ...state,
    companion: {
      ...state.companion,
      vitals,
      mood,
    },
  };
  const event = createGrowthEvent({
    companionId: state.companion.id,
    interaction: "play",
    outcome,
    sourceType: "gateway-event",
    sourceId: input.gatewayEventId,
    growthRuleVersion: profile.version,
    before,
    after: vitals,
    mood,
  });

  repo.runTransaction(() => {
    writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
    writeGrowthEvent(repo, event);
  });

  return {
    outcome,
    state: nextState,
    event,
  };
}

function applyRestRecovery(repo: CompanionStateRepository, clock: () => Date): CompanionRuntimeState {
  const state = readRuntimeState(repo, clock);
  const baseline = state.derivedVitals?.companionEnergyBaseline ?? state.companion.vitals.companionEnergy;
  const baselineAt = state.derivedVitals?.companionEnergyBaselineAt ?? clock().toISOString();
  const elapsedHours = (clock().getTime() - new Date(baselineAt).getTime()) / 3_600_000;
  const recovered =
    elapsedHours < 0 || elapsedHours > CLOCK_ANOMALY_HOURS
      ? 0
      : Math.min(REST_RECOVERY_CAP, Math.floor(elapsedHours * REST_RECOVERY_PER_HOUR));
  const companionEnergy = createCompanionEnergy(baseline + recovered);
  const nextState = {
    ...state,
    companion: {
      ...state.companion,
      vitals: {
        ...state.companion.vitals,
        companionEnergy,
      },
      mood: companionEnergy < 20 ? createMood("fatigued") : createMood("neutral"),
    },
  };

  writeRuntimeState(repo, withDerivedVitalBaselines(nextState, clock));
  return nextState;
}

function applyInteraction(
  kind: CompanionInteractionKind,
  vitals: CompanionVitals,
): { outcome: CompanionInteractionOutcome; vitals: CompanionVitals; mood: Mood } {
  if (kind === "feed") {
    return {
      outcome: "applied",
      vitals: {
        ...vitals,
        hunger: clamp(vitals.hunger + 30, 0, 100),
        intimacy: createIntimacy(vitals.intimacy + 5),
      },
      mood: createMood("positive"),
    };
  }

  if (kind === "play") {
    if (vitals.companionEnergy < 20) {
      return {
        outcome: "blocked-low-energy",
        vitals,
        mood: createMood("fatigued"),
      };
    }

    return {
      outcome: "applied",
      vitals: {
        ...vitals,
        companionEnergy: createCompanionEnergy(vitals.companionEnergy - 20),
        intimacy: createIntimacy(vitals.intimacy + 15),
        xp: Math.max(0, vitals.xp + 15),
      },
      mood: createMood("positive"),
    };
  }

  if (kind === "pet") {
    return {
      outcome: "applied",
      vitals: {
        ...vitals,
        intimacy: createIntimacy(vitals.intimacy + 10),
        xp: Math.max(0, vitals.xp + 5),
      },
      mood: createMood("positive"),
    };
  }

  return {
    outcome: "applied",
    vitals: {
      ...vitals,
      companionEnergy: createCompanionEnergy(vitals.companionEnergy + 40),
    },
    mood: createMood("sleeping"),
  };
}

function createGrowthEvent(input: {
  companionId: string;
  interaction: CompanionInteractionKind;
  outcome: CompanionInteractionOutcome | GatewayTrafficGrowthOutcome;
  sourceType?: "direct-interaction" | "gateway-event";
  sourceId?: string;
  growthRuleVersion?: string;
  before: CompanionVitals;
  after: CompanionVitals;
  mood: Mood;
}): GrowthEvent {
  return {
    id: randomUUID(),
    companionId: input.companionId,
    interaction: input.interaction,
    outcome: input.outcome,
    sourceType: input.sourceType ?? "direct-interaction",
    sourceId: input.sourceId ?? input.interaction,
    growthRuleVersion: input.growthRuleVersion ?? GROWTH_RULE_VERSION,
    before: input.before,
    after: input.after,
    mood: input.mood,
    occurredAt: new Date().toISOString(),
  };
}

function writeGrowthEvent(repo: CompanionStateRepository, event: GrowthEvent): void {
  repo.writeGrowthEvent(
    event.id,
    event.companionId,
    event.sourceType,
    event.sourceId,
    JSON.stringify(event),
    event.growthRuleVersion,
    event.occurredAt,
  );
}

function listGrowthEvents(repo: CompanionStateRepository): GrowthEvent[] {
  const rows = repo.listGrowthEvents();
  return rows.map((json) => JSON.parse(json) as GrowthEvent);
}

function normalizeTokenCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function createDefaultRuntimeState(clock: () => Date): CompanionRuntimeState {
  const now = clock().toISOString();

  return {
    companion: {
      id: DEFAULT_COMPANION_ID,
      displayName: "AgentSoul Companion",
      soulId: DEFAULT_SOUL_ID,
      petAppearance: {
        kind: "slime",
        skin: "default",
        animationStyle: "idle",
      },
      vitals: {
        level: 1,
        xp: 0,
        companionEnergy: createCompanionEnergy(100),
        hunger: 100,
        intimacy: createIntimacy(0),
      },
      mood: createMood("neutral"),
    },
    soul: {
      id: DEFAULT_SOUL_ID,
      personaName: "Default Companion Soul",
      affectiveState: {
        pleasure: 0,
        arousal: 0,
        dominance: 0,
        affectiveEnergy: createAffectiveEnergy(0),
      },
    },
    providerProfile: {
      id: DEFAULT_PROVIDER_PROFILE_ID,
      name: "Local Gateway Default",
      activationMode: "gateway-route",
      clientProtocol: "claude-messages",
      providerProtocol: "anthropic",
      targetModel: "configured-by-user",
      endpoint: "http://127.0.0.1:4317",
      },
      growthProfile: createDefaultGrowthProfile(),
      derivedVitals: {
      hungerBaseline: 100,
      hungerBaselineAt: now,
      companionEnergyBaseline: 100,
      companionEnergyBaselineAt: now,
    },
  };
}

function withDefaultGrowthProfile(state: CompanionRuntimeState): CompanionRuntimeState {
  return {
    ...state,
    growthProfile: normalizeGrowthProfile(state.growthProfile ?? createDefaultGrowthProfile()),
  };
}

function createDefaultGrowthProfile(): GrowthProfile {
  return {
    id: "default-growth-profile",
    name: "Default Growth Profile",
    version: DEFAULT_GROWTH_PROFILE_VERSION,
    xpMultiplier: 1,
    energyCostMultiplier: 1,
    fatigueThreshold: 20,
    xpDampeningMultiplier: 0.5,
    maxXpPerEvent: 50,
    maxEnergyCostPerEvent: 25,
  };
}

function normalizeGrowthProfile(profile: GrowthProfile): GrowthProfile {
  return {
    id: profile.id || "default-growth-profile",
    name: profile.name || "Default Growth Profile",
    version: profile.version || DEFAULT_GROWTH_PROFILE_VERSION,
    xpMultiplier: positiveNumber(profile.xpMultiplier, 1),
    energyCostMultiplier: positiveNumber(profile.energyCostMultiplier, 1),
    fatigueThreshold: clamp(profile.fatigueThreshold, 0, 100),
    xpDampeningMultiplier: clamp(profile.xpDampeningMultiplier, 0, 1),
    maxXpPerEvent: Math.max(0, Math.floor(positiveNumber(profile.maxXpPerEvent, 50))),
    maxEnergyCostPerEvent: Math.max(0, Math.floor(positiveNumber(profile.maxEnergyCostPerEvent, 25))),
  };
}

function calculateXpGain(tokenCount: number, profile: GrowthProfile): number {
  const raw = Math.floor((normalizeTokenCount(tokenCount) / 500) * profile.xpMultiplier);
  return Math.min(profile.maxXpPerEvent, Math.max(0, raw));
}

function calculateEnergyCost(
  tokenCount: number,
  profile: GrowthProfile,
  rounding: "floor" | "ceil",
): number {
  const raw = (normalizeTokenCount(tokenCount) / 1000) * profile.energyCostMultiplier;
  const rounded = rounding === "ceil" ? Math.ceil(raw) : Math.floor(raw);

  return Math.min(profile.maxEnergyCostPerEvent, Math.max(0, rounded));
}

function applyXpDampening(baseXp: number, fatigued: boolean, profile: GrowthProfile): number {
  if (!fatigued || baseXp <= 0) {
    return baseXp;
  }

  return Math.max(1, Math.floor(baseXp * profile.xpDampeningMultiplier));
}

function applyDerivedVitals(
  state: CompanionRuntimeState,
  clock: () => Date,
): CompanionRuntimeState {
  const baseline = state.derivedVitals ?? {
    hungerBaseline: state.companion.vitals.hunger,
    hungerBaselineAt: clock().toISOString(),
  };
  const elapsedHours = (clock().getTime() - new Date(baseline.hungerBaselineAt).getTime()) / 3_600_000;

  if (elapsedHours < 0 || elapsedHours > CLOCK_ANOMALY_HOURS) {
    return {
      ...state,
      companion: {
        ...state.companion,
        vitals: {
          ...state.companion.vitals,
          hunger: baseline.hungerBaseline,
        },
      },
      derivedVitals: baseline,
    };
  }

  const decay = Math.min(HUNGER_OFFLINE_DECAY_CAP, Math.floor(elapsedHours * HUNGER_DECAY_PER_HOUR));

  return {
    ...state,
    companion: {
      ...state.companion,
      vitals: {
        ...state.companion.vitals,
        hunger: clamp(baseline.hungerBaseline - decay, 0, 100),
      },
    },
    derivedVitals: baseline,
  };
}

function withDerivedVitalBaselines(
  state: CompanionRuntimeState,
  clock: () => Date,
): CompanionRuntimeState {
  return {
    ...state,
    derivedVitals: {
      hungerBaseline: state.companion.vitals.hunger,
      hungerBaselineAt: clock().toISOString(),
      companionEnergyBaseline: state.companion.vitals.companionEnergy,
      companionEnergyBaselineAt: clock().toISOString(),
    },
  };
}

function normalizeVitalsPatch(
  vitals?: Partial<{
    level: number;
    xp: number;
    companionEnergy: number;
    hunger: number;
    intimacy: number;
  }>,
): Partial<CompanionVitals> {
  if (!vitals) {
    return {};
  }

  return {
    ...(vitals.level === undefined ? {} : { level: Math.max(1, Math.floor(vitals.level)) }),
    ...(vitals.xp === undefined ? {} : { xp: Math.max(0, Math.floor(vitals.xp)) }),
    ...(vitals.companionEnergy === undefined
      ? {}
      : { companionEnergy: createCompanionEnergy(vitals.companionEnergy) }),
    ...(vitals.hunger === undefined ? {} : { hunger: clamp(vitals.hunger, 0, 100) }),
    ...(vitals.intimacy === undefined ? {} : { intimacy: createIntimacy(vitals.intimacy) }),
  };
}

function normalizeAffectiveState(affectiveState: {
  pleasure: number;
  arousal: number;
  dominance: number;
  affectiveEnergy: number;
}): AffectiveState {
  return {
    pleasure: clamp(affectiveState.pleasure, -1, 1),
    arousal: clamp(affectiveState.arousal, -1, 1),
    dominance: clamp(affectiveState.dominance, -1, 1),
    affectiveEnergy: createAffectiveEnergy(affectiveState.affectiveEnergy),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function positiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// ─── Re-exports from merged packages ───

export * from "./config";
export * from "./health";
export * from "./pad-engine";

// ─── Soul & Prompt (TDD Slice 2) ───
export * from "./soul";
export * from "./prompt";
export * from "./autonomy";

// ─── Repository (moved from persistence) ───
export { CompanionStateRepository } from "./companion-repository.js";
