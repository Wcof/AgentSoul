import {
  createAffectiveEnergy,
  createCompanionEnergy,
  createIntimacy,
  createMood,
  type AffectiveEnergy,
  type Companion,
  type CompanionEnergy,
  type Intimacy,
  type Mood,
  type ProviderActivationMode,
  type RiskNotice,
  type WorkSession,
} from "@agentsoul/domain";

const companionEnergy: CompanionEnergy = createCompanionEnergy(72);
const affectiveEnergy: AffectiveEnergy = createAffectiveEnergy(0.4);
const mood: Mood = createMood("positive");
const intimacy: Intimacy = createIntimacy(80);

const companion: Companion = {
  id: "companion-default",
  displayName: "AgentSoul",
  soulId: "soul-default",
  petAppearance: {
    kind: "slime",
    skin: "default",
  },
  vitals: {
    level: 1,
    xp: 0,
    companionEnergy,
    hunger: 90,
    intimacy,
  },
  mood,
};

const activationMode: ProviderActivationMode = "gateway-route";
const riskNotice: RiskNotice = {
  id: "notice-1",
  message: "Codex is running with full authorization.",
  observedAt: "2026-05-28T00:00:00.000Z",
  clientAuthorizationMode: "fully-authorized",
};
const workSession: WorkSession = {
  id: "work-session-1",
  source: "claude-code-history",
  projectPath: "/tmp/project",
  searchable: true,
  resumable: false,
  lastActiveAt: "2026-05-28T00:00:00.000Z",
};

void companion;
void activationMode;
void riskNotice;
void workSession;

// @ts-expect-error Companion Energy is an outward vital, not PAD Affective Energy.
const mixedEnergy: AffectiveEnergy = companionEnergy;

// @ts-expect-error Mood is short-term outward attitude, not long-term Intimacy.
const mixedMood: Intimacy = mood;

// @ts-expect-error Affective Energy cannot be used where Companion Energy is required.
const mixedAffective: CompanionEnergy = affectiveEnergy;
