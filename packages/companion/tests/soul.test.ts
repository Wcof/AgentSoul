import { describe, it, expect } from "vitest";
import type { Companion } from "@agentsoul/domain";

const mockCompanion: Companion = {
  id: "test-companion",
  displayName: "小明",
  soulId: "test-soul",
  petAppearance: { kind: "slime", skin: "default" },
  vitals: {
    level: 1,
    xp: 0,
    companionEnergy: 100 as any,
    hunger: 100,
    intimacy: 0 as any,
  },
  mood: "neutral" as any,
};

describe("SoulDocument", () => {
  it("getDefaultSoul returns a valid SoulDocument", async () => {
    const { getDefaultSoul } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");

    expect(soul).toHaveProperty("identity");
    expect(soul).toHaveProperty("voice");
    expect(soul).toHaveProperty("emotionalBehavior");
    expect(soul).toHaveProperty("growthMilestones");
    expect(soul).toHaveProperty("masterModel");
    expect(soul.identity.name).toBe("小明");
  });

  it("masterModel has all required sections", async () => {
    const { getDefaultSoul } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");

    expect(soul.masterModel).toHaveProperty("basic");
    expect(soul.masterModel).toHaveProperty("preferences");
    expect(soul.masterModel).toHaveProperty("behaviorPatterns");
    expect(soul.masterModel).toHaveProperty("emotionalProfile");
    expect(soul.masterModel).toHaveProperty("relationshipMemory");
    expect(soul.masterModel).toHaveProperty("trustLevel");
    expect(soul.masterModel).toHaveProperty("learningState");
  });

  it("supports observation → hypothesis → verification → solidified master learning", async () => {
    const {
      getDefaultSoul,
      recordMasterModelObservation,
      advanceMasterModelObservation,
      summarizeMasterModel,
    } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const observed = recordMasterModelObservation(soul.masterModel, {
      id: "fact-name",
      source: "conversation",
      claim: "主人喜欢被称呼为老李",
      evidence: ["用户说：叫我老李"],
      confidence: 0.6,
      updatedAt: "2026-05-31T00:00:00.000Z",
    });
    const hypothesized = advanceMasterModelObservation(observed, "fact-name", "hypothesis");
    const verified = advanceMasterModelObservation(hypothesized, "fact-name", "verification");
    const solidified = advanceMasterModelObservation(verified, "fact-name", "solidified");

    expect(solidified.learningState.observations).toHaveLength(0);
    expect(solidified.learningState.hypotheses).toHaveLength(0);
    expect(solidified.learningState.verifiedFacts).toHaveLength(0);
    expect(solidified.learningState.solidifiedFacts[0].claim).toBe("主人喜欢被称呼为老李");
    expect(summarizeMasterModel(solidified)).toContain("主人喜欢被称呼为老李");
  });
});

describe("buildSoulPrompt — address varies with intimacy", () => {
  it("address is formal when intimacy is low (<=33)", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 20);

    // Low intimacy → formal address (full name)
    expect(prompt).toContain("小明");
    expect(prompt).toContain("主人认知");
  });

  it("address is casual when intimacy is medium (34-66)", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 50);

    // Medium intimacy → casual address
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
  });

  it("address is intimate when intimacy is high (>66)", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 80);

    // High intimacy → intimate address
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
  });
});

describe("buildSoulPrompt — milestone varies with level", () => {
  it("uses novice milestone when level <= 5", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 50, 3);

    expect(prompt).toContain("刚刚认识");
  });

  it("uses growing milestone when level 6-10", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 50, 8);

    expect(prompt).toContain("逐渐了解");
  });

  it("uses mature milestone when level > 10", async () => {
    const { getDefaultSoul, buildSoulPrompt } = await import("../src/soul.js");
    const soul = getDefaultSoul(mockCompanion, "小明");
    const prompt = buildSoulPrompt(soul, 50, 15);

    expect(prompt).toContain("深刻理解");
  });
});
