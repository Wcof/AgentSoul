import { describe, it, expect } from "vitest";

const mockSoul = {
  identity: {
    name: "小明",
    personality: ["友善", "好奇"],
    coreValues: ["陪伴", "成长"],
    role: "AI 伴侣",
  },
  voice: { style: "温暖自然", tone: "友好亲切", vocabulary: "moderate" as const },
  emotionalBehavior: [
    { condition: "high_pleasure", behavior: "温暖积极" },
  ],
  growthMilestones: [
    { levelRange: [1, 5] as [number, number], label: "novice", description: "刚刚认识主人" },
    { levelRange: [6, 10] as [number, number], label: "growing", description: "逐渐了解主人" },
    { levelRange: [11, 100] as [number, number], label: "mature", description: "深刻理解主人" },
  ],
  masterModel: {
    basic: { name: "小明", preferredLanguage: "zh-CN", timezone: "Asia/Shanghai" },
    preferences: { interests: [], communicationStyle: "待观察", topics: [] },
    behaviorPatterns: { activeHours: [], interactionFrequency: "待观察", responsePreference: "待观察" },
    emotionalProfile: { baseline: "neutral", triggers: [], comfort: [] },
    relationshipMemory: { firstMet: "2026-01-01", significantEvents: [], insideJokes: [] },
    trustLevel: 10,
    learningState: {
      observations: [],
      hypotheses: [],
      verifiedFacts: [{ id: "name", stage: "verification", source: "conversation", claim: "主人喜欢猫", evidence: ["用户说过喜欢猫"], confidence: 0.8, updatedAt: "2026-05-31" }],
      solidifiedFacts: [],
    },
  },
};

const mockPadState = { pleasure: 0.3, arousal: -0.1, dominance: 0.2 };
const mockVitals = { energy: 80, hunger: 60, intimacy: 45 };

describe("PromptBuilder", () => {
  it("returns object with stable, context, volatile layers", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(mockSoul as any, mockPadState, mockVitals, [], "");

    expect(result).toHaveProperty("stable");
    expect(result).toHaveProperty("context");
    expect(result).toHaveProperty("volatile");
    expect(typeof result.stable).toBe("string");
    expect(typeof result.context).toBe("string");
    expect(typeof result.volatile).toBe("string");
  });

  it("stable layer contains identity, voice, and milestone", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(mockSoul as any, mockPadState, mockVitals, [], "");

    expect(result.stable).toContain("友善");
    expect(result.stable).toContain("温暖自然");
    expect(result.stable).toContain("刚刚认识");
  });

  it("context layer contains PAD values and vitals", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(mockSoul as any, mockPadState, mockVitals, [], "");

    expect(result.context).toContain("0.3");   // pleasure
    expect(result.context).toContain("-0.1");  // arousal
    expect(result.context).toContain("0.2");   // dominance
    expect(result.context).toContain("80");    // energy
    expect(result.context).toContain("60");    // hunger
    expect(result.context).toContain("45");    // intimacy
    expect(result.context).toContain("主人画像");
    expect(result.context).toContain("主人喜欢猫");
  });

  it("volatile layer contains memories and session context", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const memories = [{ text: "用户喜欢猫" }];
    const result = buildSystemPrompt(mockSoul as any, mockPadState, mockVitals, memories, "");

    expect(result.volatile).toContain("用户喜欢猫");
  });
});

describe("PAD emotional behavior mapping", () => {
  it("maps high pleasure to warm behavior description", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(
      mockSoul as any,
      { pleasure: 0.5, arousal: 0, dominance: 0 },
      mockVitals,
      [],
      "",
    );

    expect(result.context).toContain("温暖");
  });

  it("maps high arousal to alert behavior description", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(
      mockSoul as any,
      { pleasure: 0, arousal: 0.5, dominance: 0 },
      mockVitals,
      [],
      "",
    );

    expect(result.context).toContain("警觉");
  });

  it("maps low dominance to humble behavior description", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(
      mockSoul as any,
      { pleasure: 0, arousal: 0, dominance: -0.5 },
      mockVitals,
      [],
      "",
    );

    expect(result.context).toContain("谦逊");
  });

  it("maps neutral PAD to neutral description", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(
      mockSoul as any,
      { pleasure: 0, arousal: 0, dominance: 0 },
      mockVitals,
      [],
      "",
    );

    expect(result.context).toContain("中性");
  });

  it("names the emotion from PAD values", async () => {
    const { buildSystemPrompt } = await import("../src/prompt.js");
    const result = buildSystemPrompt(
      mockSoul as any,
      { pleasure: 0.5, arousal: 0.3, dominance: 0.2 },
      mockVitals,
      [],
      "",
    );

    expect(result.context).toContain("excited_confident");
  });
});
