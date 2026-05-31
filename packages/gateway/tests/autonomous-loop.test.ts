import { describe, expect, it, vi } from "vitest";
import { createAutonomousLoopService } from "@agentsoul/gateway";

describe("autonomous loop service", () => {
  it("processes periodic time perception without surfacing low-priority output", () => {
    const now = new Date("2026-05-31T00:00:00.000Z");
    const service = createAutonomousLoopService({ clock: () => now });

    const decision = service.tick(now);

    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0]).toMatchObject({
      kind: "internal",
      priority: "LOW",
      outputStrategy: "silent",
    });
    expect(service.getSnapshot()).toMatchObject({
      userPresence: "PRESENT",
      companionMode: "AUTONOMOUS",
      lastEventPriority: "LOW",
      lastOutputStrategy: "silent",
      queuedOutputCount: 0,
      lastAction: "reflect-and-update-affect",
    });
    service.close();
  });

  it("queues medium-priority memory output while cooling down and drains it", () => {
    const now = new Date("2026-05-31T00:00:00.000Z");
    const service = createAutonomousLoopService({ clock: () => now });

    service.processEvent({
      id: "memory-1",
      source: "memory",
      priority: "MEDIUM",
      description: "主人提过喜欢安静的工作环境",
      observedAt: now.toISOString(),
    });

    expect(service.getSnapshot()).toMatchObject({
      companionMode: "QUEUING",
      lastEventPriority: "MEDIUM",
      lastOutputStrategy: "queue",
      queuedOutputCount: 1,
    });
    expect(service.drainQueuedOutputs()).toHaveLength(1);
    expect(service.getSnapshot()).toMatchObject({
      companionMode: "AUTONOMOUS",
      queuedOutputCount: 0,
    });
    service.close();
  });

  it("interrupts conversation for high-priority system perception", () => {
    const now = new Date("2026-05-31T00:00:00.000Z");
    const service = createAutonomousLoopService({ clock: () => now });
    service.updateMode("CONVERSING");

    service.processEvent({
      id: "system-1",
      source: "system",
      priority: "HIGH",
      description: "Gateway health check failed",
      observedAt: now.toISOString(),
    });

    expect(service.getSnapshot()).toMatchObject({
      companionMode: "INTRUDING",
      lastEventPriority: "HIGH",
      lastOutputStrategy: "interrupt",
    });
    service.close();
  });

  it("runs and stops its optional periodic timer", () => {
    vi.useFakeTimers();
    const onDecision = vi.fn();
    const service = createAutonomousLoopService({
      tickIntervalMs: 1_000,
      onDecision,
    });

    vi.advanceTimersByTime(2_500);
    expect(onDecision).toHaveBeenCalledTimes(2);

    service.close();
    vi.advanceTimersByTime(2_500);
    expect(onDecision).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
