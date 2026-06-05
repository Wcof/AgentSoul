import { describe, expect, it } from "vitest";
import { applyMasterModelCommand } from "@agentsoul/memory";

const baseMasterModel = {
  basic: { name: "主人", preferredLanguage: "zh-CN", timezone: "Asia/Shanghai" },
  preferences: { interests: [], hobbies: [], communicationStyle: "直接" },
  behaviorPatterns: { responsePreference: "短句" },
  emotionalProfile: { baseline: "neutral", triggers: [], comfort: [] },
  relationshipMemory: { firstMet: "2026-01-01", significantEvents: [], insideJokes: [] },
  trustLevel: 10,
  learningState: {
    observations: [],
    hypotheses: [],
    verifiedFacts: [],
    solidifiedFacts: [],
  },
};

describe("Master Model command seam", () => {
  it("records, advances, and forgets observations without UI snapshot state", () => {
    const recorded = applyMasterModelCommand(baseMasterModel as never, {
      kind: "record",
      claim: "主人喜欢结构化总结",
      evidence: ["用户要求最终回复列出修改文件、核心改动、测试结果"],
      confidence: 0.9,
    });
    const observationId = recorded.learningState.observations[0].id;

    const advanced = applyMasterModelCommand(recorded, {
      kind: "advance",
      observationId,
      stage: "verification",
    });

    expect(advanced.learningState.observations).toHaveLength(0);
    expect(advanced.learningState.verifiedFacts[0].claim).toBe("主人喜欢结构化总结");

    const forgotten = applyMasterModelCommand(advanced, {
      kind: "forget",
      observationId,
    });

    expect(forgotten.learningState.verifiedFacts).toHaveLength(0);
  });
});
