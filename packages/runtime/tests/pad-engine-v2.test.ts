// PAD Engine v2 测试 — 事件扰动、情绪共振、漂移检测、时间衰减、基线更新
import { describe, it, expect } from "vitest";
import {
  applyEventPerturbation,
  applyEmotionResonance,
  nameEmotion,
  detectDrift,
  applyTimeDecay,
  updateBaseline,
  type PADState,
  type PADBaseline,
  type EmotionLabel,
} from "@agentsoul/runtime";

// 辅助：创建初始 PAD 状态
function makePAD(pleasure = 0, arousal = 0, dominance = 0, energy = 0): PADState {
  return { pleasure, arousal, dominance, affectiveEnergy: energy };
}

// 辅助：创建基线
function makeBaseline(pleasure = 0, arousal = 0, dominance = 0): PADBaseline {
  return { pleasure, arousal, dominance };
}

describe("PAD Engine v2 — 事件扰动", () => {
  it("positive 事件提升 pleasure", () => {
    const pad = makePAD(0, 0, 0, 0);
    const result = applyEventPerturbation(pad, "positive", 1.0);
    expect(result.pleasure).toBeGreaterThan(0);
    expect(result.arousal).toBeGreaterThanOrEqual(0);
  });

  it("negative 事件降低 pleasure", () => {
    const pad = makePAD(0.5, 0, 0, 0);
    const result = applyEventPerturbation(pad, "negative", 1.0);
    expect(result.pleasure).toBeLessThan(0.5);
  });

  it("stress 事件提升 arousal", () => {
    const pad = makePAD(0, 0, 0, 0);
    const result = applyEventPerturbation(pad, "stress", 1.0);
    expect(result.arousal).toBeGreaterThan(0);
  });

  it("conflict 事件降低 dominance", () => {
    const pad = makePAD(0, 0, 0.5, 0);
    const result = applyEventPerturbation(pad, "conflict", 1.0);
    expect(result.dominance).toBeLessThan(0.5);
  });

  it("intensity 可配置", () => {
    const pad1 = makePAD(0, 0, 0, 0);
    const pad2 = makePAD(0, 0, 0, 0);
    const low = applyEventPerturbation(pad1, "positive", 0.3);
    const high = applyEventPerturbation(pad2, "positive", 1.0);
    expect(high.pleasure).toBeGreaterThan(low.pleasure);
  });

  it("PAD 值域约束 [-1, 1]", () => {
    const pad = makePAD(0.9, 0.9, 0.9, 0);
    const result = applyEventPerturbation(pad, "positive", 1.0);
    expect(result.pleasure).toBeLessThanOrEqual(1);
    expect(result.arousal).toBeLessThanOrEqual(1);
    expect(result.dominance).toBeLessThanOrEqual(1);
    expect(result.pleasure).toBeGreaterThanOrEqual(-1);
    expect(result.arousal).toBeGreaterThanOrEqual(-1);
    expect(result.dominance).toBeGreaterThanOrEqual(-1);
  });
});

describe("PAD Engine v2 — 情绪共振", () => {
  it("连续同类事件放大效果", () => {
    const base = makePAD(0, 0, 0, 0);
    const first = applyEventPerturbation(base, "positive", 1.0);
    const resonanceConfig = { eventType: "positive", count: 2, boostFactor: 0.5, windowMs: 60000 };
    const amplified = applyEmotionResonance(first, resonanceConfig);
    expect(amplified.pleasure).toBeGreaterThan(first.pleasure);
  });

  it("第 N 次放大 = base * (1 + boost * (N-1))", () => {
    const base = makePAD(0, 0, 0, 0);
    const perturbation = applyEventPerturbation(base, "positive", 1.0);
    const shift = perturbation.pleasure - base.pleasure;
    const config = { eventType: "positive", count: 3, boostFactor: 0.5, windowMs: 60000 };
    const amplified = applyEmotionResonance(perturbation, config);
    const expectedPleasure = base.pleasure + shift * (1 + 0.5 * 2);
    expect(amplified.pleasure).toBeCloseTo(Math.min(1, expectedPleasure), 5);
  });
});

describe("PAD Engine v2 — 情绪命名 (Mehrabian 8 象限)", () => {
  it("P+ A+ D+ = excited_confident", () => {
    expect(nameEmotion(0.5, 0.5, 0.5)).toBe("excited_confident");
  });

  it("P- A+ D- = anxious_fearful", () => {
    expect(nameEmotion(-0.5, 0.5, -0.5)).toBe("anxious_fearful");
  });

  it("P- A- D- = melancholic_sad", () => {
    expect(nameEmotion(-0.5, -0.5, -0.5)).toBe("melancholic_sad");
  });

  it("P+ A- D+ = relaxed_content", () => {
    expect(nameEmotion(0.5, -0.5, 0.5)).toBe("relaxed_content");
  });

  it("接近零点 = neutral_calm", () => {
    expect(nameEmotion(0.05, 0.05, 0.05)).toBe("neutral_calm");
  });
});

describe("PAD Engine v2 — 漂移检测", () => {
  it("距离 < 0.2 = none", () => {
    const current = makePAD(0.1, 0.1, 0.1);
    const baseline = makeBaseline(0, 0, 0);
    expect(detectDrift(current, baseline).severity).toBe("none");
  });

  it("距离 0.2-0.4 = mild", () => {
    const current = makePAD(0.3, 0, 0);
    const baseline = makeBaseline(0, 0, 0);
    const report = detectDrift(current, baseline);
    expect(report.severity).toBe("mild");
  });

  it("距离 0.4-0.6 = moderate", () => {
    const current = makePAD(0.5, 0, 0);
    const baseline = makeBaseline(0, 0, 0);
    expect(detectDrift(current, baseline).severity).toBe("moderate");
  });

  it("距离 >= 0.6 = severe", () => {
    const current = makePAD(0.7, 0, 0);
    const baseline = makeBaseline(0, 0, 0);
    expect(detectDrift(current, baseline).severity).toBe("severe");
  });
});

describe("PAD Engine v2 — 时间衰减", () => {
  it("PAD 向基线回归", () => {
    const current = makePAD(0.8, -0.3, 0);
    const baseline = makeBaseline(0, 0, 0);
    const result = applyTimeDecay(current, baseline, 1.0, 0.1);
    expect(result.pleasure).toBeLessThan(0.8);
    expect(result.pleasure).toBeGreaterThan(0);
    expect(result.arousal).toBeGreaterThan(-0.3);
  });

  it("衰减速率可配置", () => {
    const current = makePAD(0.8, 0, 0);
    const baseline = makeBaseline(0, 0, 0);
    const slow = applyTimeDecay(current, baseline, 1.0, 0.05);
    const fast = applyTimeDecay(current, baseline, 1.0, 0.2);
    expect(fast.pleasure).toBeLessThan(slow.pleasure);
  });

  it("已在基线附近不会过冲", () => {
    const current = makePAD(0.05, 0.05, 0.05);
    const baseline = makeBaseline(0, 0, 0);
    const result = applyTimeDecay(current, baseline, 10.0, 0.5);
    expect(Math.abs(result.pleasure)).toBeLessThan(0.1);
  });
});

describe("PAD Engine v2 — 基线更新", () => {
  it("从历史缓慢演化 (20% weight)", () => {
    const baseline = makeBaseline(0, 0, 0);
    const current = makePAD(0.5, 0.3, -0.2);
    const updated = updateBaseline(baseline, current, 0.2);
    expect(updated.pleasure).toBeCloseTo(0.1, 5);
    expect(updated.arousal).toBeCloseTo(0.06, 5);
    expect(updated.dominance).toBeCloseTo(-0.04, 5);
  });

  it("weight=0 不变", () => {
    const baseline = makeBaseline(0.2, 0.2, 0.2);
    const current = makePAD(0.8, 0.8, 0.8);
    const updated = updateBaseline(baseline, current, 0);
    expect(updated.pleasure).toBe(0.2);
  });
});
