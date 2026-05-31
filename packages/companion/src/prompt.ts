import type { SoulDocument } from "./soul.js";
import { summarizeMasterModel } from "./soul.js";

// ─── 3-Layer Prompt Builder ───

export interface PromptLayers {
  stable: string;   // identity, voice, milestone (rarely changes)
  context: string;  // PAD state + vitals (changes per session)
  volatile: string; // memories + session context (changes per turn)
}

export interface PromptPADState {
  pleasure: number;
  arousal: number;
  dominance: number;
}

export interface VitalsSnapshot {
  energy: number;
  hunger: number;
  intimacy: number;
}

export interface MemoryEntry {
  text: string;
}

function getMilestoneForLevel(milestones: SoulDocument["growthMilestones"], level: number) {
  return milestones.find((m) => level >= m.levelRange[0] && level <= m.levelRange[1])
    ?? milestones[milestones.length - 1];
}

function buildStableLayer(soul: SoulDocument, level: number = 1): string {
  const personality = soul.identity.personality.join("、");
  const values = soul.identity.coreValues.join("、");
  const milestone = getMilestoneForLevel(soul.growthMilestones, level);

  return [
    `身份：${soul.identity.name}，${soul.identity.role}。`,
    `性格：${personality}。`,
    `核心价值：${values}。`,
    `说话风格：${soul.voice.style}，语调${soul.voice.tone}。`,
    `成长阶段：${milestone.description}。`,
  ].join("\n");
}

function classifyPAD(pad: PromptPADState): { behavior: string; emotion: string } {
  const p = pad.pleasure > 0.1 ? "high" : pad.pleasure < -0.1 ? "low" : "mid";
  const a = pad.arousal > 0.1 ? "high" : pad.arousal < -0.1 ? "low" : "mid";
  const d = pad.dominance > 0.1 ? "high" : pad.dominance < -0.1 ? "low" : "mid";

  // Mehrabian 8-quadrant emotion labeling
  const emotionMap: Record<string, string> = {
    "high_high_high": "excited_confident",
    "low_high_low": "anxious_fearful",
    "low_low_low": "melancholic_sad",
    "low_low_high": "bored_passive",
    "high_low_high": "relaxed_content",
    "low_high_high": "angry_hostile",
    "high_high_low": "surprised_alert",
  };

  const behaviorMap: Record<string, string> = {
    "high_pleasure": "温暖积极，主动分享",
    "low_pleasure": "安静陪伴，温和安慰",
    "high_arousal": "警觉活跃，频繁互动",
    "low_arousal": "安静放松，不主动打扰",
    "high_dominance": "自信主导，主动建议",
    "low_dominance": "谦逊征求意见，跟随用户",
  };

  const key = `${p}_${a}_${d}`;
  const emotion = emotionMap[key] ?? "neutral_calm";

  // Build behavior description from PAD dimensions
  const behaviors: string[] = [];
  if (p === "high") behaviors.push(behaviorMap["high_pleasure"]);
  else if (p === "low") behaviors.push(behaviorMap["low_pleasure"]);
  if (a === "high") behaviors.push(behaviorMap["high_arousal"]);
  else if (a === "low") behaviors.push(behaviorMap["low_arousal"]);
  if (d === "low") behaviors.push(behaviorMap["low_dominance"]);
  else if (d === "high") behaviors.push(behaviorMap["high_dominance"]);

  const behavior = behaviors.length > 0 ? behaviors.join("，") : "中性平静，自然交流";

  return { behavior, emotion };
}

function buildContextLayer(pad: PromptPADState, vitals: VitalsSnapshot): string {
  const { behavior, emotion } = classifyPAD(pad);

  return [
    `情感状态：pleasure=${pad.pleasure}, arousal=${pad.arousal}, dominance=${pad.dominance}。`,
    `情绪标签：${emotion}。`,
    `行为倾向：${behavior}。`,
    `体征：energy=${vitals.energy}, hunger=${vitals.hunger}, intimacy=${vitals.intimacy}。`,
  ].join("\n");
}

function buildMasterModelContext(soul: SoulDocument): string {
  return [
    "主人画像：",
    summarizeMasterModel(soul.masterModel),
  ].join("\n");
}

function buildVolatileLayer(memories: MemoryEntry[], sessionContext: string): string {
  const parts: string[] = [];

  if (memories.length > 0) {
    parts.push(`相关记忆：${memories.map((m) => m.text).join("；")}。`);
  }

  if (sessionContext) {
    parts.push(`会话上下文：${sessionContext}`);
  }

  return parts.join("\n");
}

export function buildSystemPrompt(
  soul: SoulDocument,
  pad: PromptPADState,
  vitals: VitalsSnapshot,
  memories: MemoryEntry[],
  sessionContext: string,
  level: number = 1,
): PromptLayers {
  return {
    stable: buildStableLayer(soul, level),
    context: [buildContextLayer(pad, vitals), buildMasterModelContext(soul)].join("\n\n"),
    volatile: buildVolatileLayer(memories, sessionContext),
  };
}
