import { describe, expect, it } from "vitest";

describe("Companion autonomy state machine", () => {
  it("keeps low priority time ticks internal and silent", async () => {
    const { createDefaultAutonomyState, decideAutonomousActions } = await import("../src/autonomy.js");
    const now = new Date("2026-05-31T00:00:00.000Z");
    const state = createDefaultAutonomyState(now);
    const decision = decideAutonomousActions(state, {
      id: "tick-1",
      source: "time",
      priority: "LOW",
      description: "定时心跳",
      observedAt: now.toISOString(),
    }, now);

    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0].kind).toBe("internal");
    expect(decision.actions[0].outputStrategy).toBe("silent");
    expect(decision.nextState.companionMode).toBe("AUTONOMOUS");
  });

  it("queues non-critical memory output while conversing", async () => {
    const { decideAutonomousActions } = await import("../src/autonomy.js");
    const now = new Date("2026-05-31T00:00:00.000Z");
    const decision = decideAutonomousActions({
      userPresence: "ACTIVE",
      companionMode: "CONVERSING",
      queuedOutputs: [],
    }, {
      id: "memory-1",
      source: "memory",
      priority: "MEDIUM",
      description: "想起主人喜欢猫",
      observedAt: now.toISOString(),
    }, now);

    expect(decision.actions.some((action) => action.kind === "communicative")).toBe(true);
    expect(decision.nextState.companionMode).toBe("QUEUING");
    expect(decision.nextState.queuedOutputs[0].outputStrategy).toBe("queue");
  });

  it("allows high priority events to interrupt conversation", async () => {
    const { decideAutonomousActions } = await import("../src/autonomy.js");
    const now = new Date("2026-05-31T00:00:00.000Z");
    const decision = decideAutonomousActions({
      userPresence: "ACTIVE",
      companionMode: "CONVERSING",
      queuedOutputs: [],
    }, {
      id: "alert-1",
      source: "system",
      priority: "HIGH",
      description: "网关连续失败",
      observedAt: now.toISOString(),
    }, now);

    expect(decision.nextState.companionMode).toBe("INTRUDING");
    expect(decision.actions.find((action) => action.kind === "communicative")?.outputStrategy).toBe("interrupt");
  });
});
