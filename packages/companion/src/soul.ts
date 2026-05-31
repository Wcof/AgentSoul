import type { Companion } from "@agentsoul/domain";

// ─── SoulDocument: The companion's personality carrier ───

export interface SoulIdentity {
  name: string;
  personality: string[];
  coreValues: string[];
  role: string;
}

export interface SoulVoice {
  style: string;
  tone: string;
  vocabulary: "simple" | "moderate" | "rich";
}

export interface EmotionalBehaviorRule {
  condition: string; // e.g. "high_pleasure", "low_dominance"
  behavior: string;  // e.g. "温暖积极", "谦逊征求意见"
}

export interface GrowthMilestone {
  levelRange: [number, number]; // [min, max]
  label: string;               // e.g. "novice", "growing", "mature"
  description: string;
}

export interface MasterModel {
  basic: {
    name: string;
    nickname?: string;
    preferredLanguage: string;
    timezone: string;
    heightCm?: number;
    weightKg?: number;
  };
  preferences: {
    interests: string[];
    hobbies?: string[];
    communicationStyle: string;
    topics: string[];
    tabooTopics?: string[];
  };
  behaviorPatterns: {
    activeHours: string[];
    interactionFrequency: string;
    responsePreference: string;
    workPatterns?: string[];
    commonTools?: string[];
    stressSignals?: string[];
  };
  emotionalProfile: {
    baseline: string;
    triggers: string[];
    comfort: string[];
    joyTriggers?: string[];
    frustrationTriggers?: string[];
    stressResponse?: string;
    comfortPreference?: string;
  };
  relationshipMemory: {
    firstMet: string;
    significantEvents: string[];
    insideJokes: string[];
    sharedExperiences?: string[];
  };
  trustLevel: number; // 0-100
  learningState: MasterModelLearningState;
}

export type MasterModelLearningStage = "observation" | "hypothesis" | "verification" | "solidified";

export interface MasterModelObservation {
  id: string;
  stage: MasterModelLearningStage;
  source: "conversation" | "interaction" | "gateway" | "manual";
  claim: string;
  evidence: string[];
  confidence: number;
  updatedAt: string;
}

export interface SoulDocument {
  identity: SoulIdentity;
  voice: SoulVoice;
  emotionalBehavior: EmotionalBehaviorRule[];
  growthMilestones: GrowthMilestone[];
  masterModel: MasterModel;
}

export interface MasterModelLearningState {
  observations: MasterModelObservation[];
  hypotheses: MasterModelObservation[];
  verifiedFacts: MasterModelObservation[];
  solidifiedFacts: MasterModelObservation[];
}

export function getDefaultSoul(companion: Companion, displayName: string): SoulDocument {
  return {
    identity: {
      name: displayName,
      personality: ["友善", "好奇", "忠诚"],
      coreValues: ["陪伴", "成长", "信任"],
      role: "AI 伴侣",
    },
    voice: {
      style: "温暖自然",
      tone: "友好亲切",
      vocabulary: "moderate",
    },
    emotionalBehavior: [
      { condition: "high_pleasure", behavior: "温暖积极，主动分享" },
      { condition: "low_pleasure", behavior: "安静陪伴，温和安慰" },
      { condition: "high_arousal", behavior: "警觉活跃，频繁互动" },
      { condition: "low_arousal", behavior: "安静放松，不主动打扰" },
      { condition: "high_dominance", behavior: "自信主导，主动建议" },
      { condition: "low_dominance", behavior: "谦逊征求意见，跟随用户" },
    ],
    growthMilestones: [
      {
        levelRange: [1, 5],
        label: "novice",
        description: "刚刚认识主人，正在学习适应",
      },
      {
        levelRange: [6, 10],
        label: "growing",
        description: "逐渐了解主人的习惯和偏好",
      },
      {
        levelRange: [11, 100],
        label: "mature",
        description: "深刻理解主人，能预判需求",
      },
    ],
    masterModel: {
      basic: {
        name: displayName,
        nickname: "",
        preferredLanguage: "zh-CN",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      preferences: {
        interests: [],
        hobbies: [],
        communicationStyle: "待观察",
        topics: [],
        tabooTopics: [],
      },
      behaviorPatterns: {
        activeHours: [],
        interactionFrequency: "待观察",
        responsePreference: "待观察",
        workPatterns: [],
        commonTools: [],
        stressSignals: [],
      },
      emotionalProfile: {
        baseline: "neutral",
        triggers: [],
        comfort: [],
        joyTriggers: [],
        frustrationTriggers: [],
        stressResponse: "待观察",
        comfortPreference: "待观察",
      },
      relationshipMemory: {
        firstMet: new Date().toISOString(),
        significantEvents: [],
        insideJokes: [],
        sharedExperiences: [],
      },
      trustLevel: 10,
      learningState: {
        observations: [],
        hypotheses: [],
        verifiedFacts: [],
        solidifiedFacts: [],
      },
    },
  };
}

export function recordMasterModelObservation(
  masterModel: MasterModel,
  input: Omit<MasterModelObservation, "id" | "stage" | "updatedAt"> & {
    id?: string;
    stage?: MasterModelLearningStage;
    updatedAt?: string;
  },
): MasterModel {
  const observation: MasterModelObservation = {
    id: input.id ?? `master-observation-${Date.now()}`,
    stage: input.stage ?? "observation",
    source: input.source,
    claim: input.claim,
    evidence: input.evidence,
    confidence: clampConfidence(input.confidence),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  return normalizeMasterLearningState({
    ...masterModel,
    learningState: {
      ...masterModel.learningState,
      observations: [...(masterModel.learningState?.observations ?? []), observation],
    },
  });
}

export function advanceMasterModelObservation(
  masterModel: MasterModel,
  observationId: string,
  nextStage: MasterModelLearningStage,
): MasterModel {
  const all = [
    ...(masterModel.learningState?.observations ?? []),
    ...(masterModel.learningState?.hypotheses ?? []),
    ...(masterModel.learningState?.verifiedFacts ?? []),
    ...(masterModel.learningState?.solidifiedFacts ?? []),
  ];
  const target = all.find((item) => item.id === observationId);
  if (!target) return normalizeMasterLearningState(masterModel);

  const moved = { ...target, stage: nextStage, updatedAt: new Date().toISOString() };
  const withoutTarget = (items: MasterModelObservation[]) => items.filter((item) => item.id !== observationId);
  const next = {
    observations: withoutTarget(masterModel.learningState?.observations ?? []),
    hypotheses: withoutTarget(masterModel.learningState?.hypotheses ?? []),
    verifiedFacts: withoutTarget(masterModel.learningState?.verifiedFacts ?? []),
    solidifiedFacts: withoutTarget(masterModel.learningState?.solidifiedFacts ?? []),
  };
  bucketForStage(next, nextStage).push(moved);
  return normalizeMasterLearningState({ ...masterModel, learningState: next });
}

export function summarizeMasterModel(masterModel: MasterModel): string {
  const basic = masterModel.basic;
  const preferences = masterModel.preferences;
  const behavior = masterModel.behaviorPatterns;
  const emotion = masterModel.emotionalProfile;
  const relationship = masterModel.relationshipMemory;
  const learning = normalizeMasterLearningState(masterModel).learningState;
  const solidFacts = learning.solidifiedFacts.map((item) => item.claim);
  const verifiedFacts = learning.verifiedFacts.map((item) => item.claim);

  return [
    `主人名称：${basic.name || "待观察"}${basic.nickname ? `（常用称呼：${basic.nickname}）` : ""}。`,
    `偏好语言：${basic.preferredLanguage || "待观察"}；时区：${basic.timezone || "待观察"}。`,
    `兴趣：${listOrPending(preferences.interests)}；爱好：${listOrPending(preferences.hobbies ?? [])}。`,
    `沟通风格：${preferences.communicationStyle || "待观察"}；响应偏好：${behavior.responsePreference || "待观察"}。`,
    `活跃时间：${listOrPending(behavior.activeHours)}；常用工具：${listOrPending(behavior.commonTools ?? [])}。`,
    `压力信号：${listOrPending(behavior.stressSignals ?? [])}；安慰偏好：${emotion.comfortPreference || listOrPending(emotion.comfort)}。`,
    `重要关系记忆：${listOrPending(relationship.significantEvents)}；内部梗：${listOrPending(relationship.insideJokes)}。`,
    `已固化事实：${listOrPending(solidFacts)}；已验证事实：${listOrPending(verifiedFacts)}。`,
    `信任等级：${masterModel.trustLevel}/100。`,
  ].join("\n");
}

function normalizeMasterLearningState(masterModel: MasterModel): MasterModel {
  return {
    ...masterModel,
    learningState: {
      observations: masterModel.learningState?.observations ?? [],
      hypotheses: masterModel.learningState?.hypotheses ?? [],
      verifiedFacts: masterModel.learningState?.verifiedFacts ?? [],
      solidifiedFacts: masterModel.learningState?.solidifiedFacts ?? [],
    },
  };
}

function bucketForStage(
  state: MasterModelLearningState,
  stage: MasterModelLearningStage,
): MasterModelObservation[] {
  if (stage === "hypothesis") return state.hypotheses;
  if (stage === "verification") return state.verifiedFacts;
  if (stage === "solidified") return state.solidifiedFacts;
  return state.observations;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function listOrPending(values: string[]): string {
  const present = values.map((value) => value.trim()).filter(Boolean);
  return present.length > 0 ? present.join("、") : "待观察";
}

// ─── buildSoulPrompt: Generate system prompt from SoulDocument ───

function getAddressForIntimacy(name: string, intimacy: number): string {
  if (intimacy <= 33) {
    return name; // formal: full name
  }
  if (intimacy <= 66) {
    return `${name}~`; // casual
  }
  return `亲爱的${name}`; // intimate
}

function getMilestoneForLevel(milestones: GrowthMilestone[], level: number): GrowthMilestone {
  return milestones.find((m) => level >= m.levelRange[0] && level <= m.levelRange[1])
    ?? milestones[milestones.length - 1];
}

export function buildSoulPrompt(soul: SoulDocument, intimacyLevel: number, level: number = 1): string {
  const address = getAddressForIntimacy(soul.identity.name, intimacyLevel);
  const personality = soul.identity.personality.join("、");
  const values = soul.identity.coreValues.join("、");
  const milestone = getMilestoneForLevel(soul.growthMilestones, level);

  return [
    `你是${address}的${soul.identity.role}。`,
    `性格：${personality}。`,
    `核心价值：${values}。`,
    `说话风格：${soul.voice.style}，语调${soul.voice.tone}。`,
    `成长阶段：${milestone.description}。`,
    `主人认知：${summarizeMasterModel(soul.masterModel)}`,
  ].join("\n");
}
