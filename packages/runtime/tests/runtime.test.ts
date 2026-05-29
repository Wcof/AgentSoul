import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMood } from "@agentsoul/domain";
import { createCompanionRuntime } from "@agentsoul/runtime";

describe("AgentSoul v2 runtime", () => {
  it("creates a default DB-backed Companion Runtime State", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        const state = runtime.getCompanionRuntimeState();

        expect(state.companion.id).toBe("active-companion");
        expect(state.companion.soulId).toBe(state.soul.id);
        expect(state.companion.vitals.level).toBe(1);
        expect(state.companion.vitals.companionEnergy).toBe(100);
        expect(state.companion.petAppearance.kind).toBe("slime");
        expect(state.providerProfile.activationMode).toBe("gateway-route");
      } finally {
        runtime.close();
      }
    });
  });

  it("persists vitals and mood updates across runtime instances", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      runtime.updateCompanionVitalsAndMood({
        vitals: {
          level: 2,
          xp: 15,
          companionEnergy: 76,
          hunger: 64,
          intimacy: 28,
        },
        mood: createMood("positive"),
      });
      runtime.close();

      const reopened = createCompanionRuntime({ dbPath });
      try {
        const state = reopened.getCompanionRuntimeState();

        expect(state.companion.vitals.level).toBe(2);
        expect(state.companion.vitals.xp).toBe(15);
        expect(state.companion.vitals.companionEnergy).toBe(76);
        expect(state.companion.vitals.hunger).toBe(64);
        expect(state.companion.vitals.intimacy).toBe(28);
        expect(state.companion.mood).toBe("positive");
      } finally {
        reopened.close();
      }
    });
  });

  it("changes pet appearance without changing Companion identity, Soul, or Provider Profile", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        const before = runtime.getCompanionRuntimeState();
        const after = runtime.updatePetAppearance({
          kind: "cat",
          skin: "calico",
          outfit: "hoodie",
          animationStyle: "thinking",
        });

        expect(after.companion.id).toBe(before.companion.id);
        expect(after.companion.soulId).toBe(before.companion.soulId);
        expect(after.soul).toEqual(before.soul);
        expect(after.providerProfile).toEqual(before.providerProfile);
        expect(after.companion.petAppearance).toEqual({
          kind: "cat",
          skin: "calico",
          outfit: "hoodie",
          animationStyle: "thinking",
        });
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Companion Growth interactions", () => {
  it("updates Runtime State and persists events for direct user interactions", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        runtime.updateCompanionVitalsAndMood({
          vitals: { hunger: 50, intimacy: 10, companionEnergy: 30, xp: 0 },
          mood: createMood("neutral"),
        });

        const feed = runtime.performCompanionInteraction("feed");
        expect(feed.outcome).toBe("applied");
        expect(feed.state.companion.vitals.hunger).toBe(80);
        expect(feed.state.companion.vitals.intimacy).toBe(15);

        const play = runtime.performCompanionInteraction("play");
        expect(play.outcome).toBe("applied");
        expect(play.state.companion.vitals.companionEnergy).toBe(10);
        expect(play.state.companion.vitals.intimacy).toBe(30);
        expect(play.state.companion.vitals.xp).toBe(15);
        expect(play.state.companion.mood).toBe("positive");

        const blockedPlay = runtime.performCompanionInteraction("play");
        expect(blockedPlay.outcome).toBe("blocked-low-energy");
        expect(blockedPlay.state.companion.vitals.companionEnergy).toBe(10);
        expect(blockedPlay.state.companion.vitals.xp).toBe(15);

        const pet = runtime.performCompanionInteraction("pet");
        expect(pet.outcome).toBe("applied");
        expect(pet.state.companion.vitals.intimacy).toBe(40);
        expect(pet.state.companion.vitals.xp).toBe(20);

        const sleep = runtime.performCompanionInteraction("sleep");
        expect(sleep.outcome).toBe("applied");
        expect(sleep.state.companion.vitals.companionEnergy).toBe(50);
        expect(sleep.state.companion.mood).toBe("sleeping");

        const events = runtime.listGrowthEvents();
        expect(events.map((event) => [event.interaction, event.outcome])).toEqual([
            ["feed", "applied"],
            ["play", "applied"],
            ["play", "blocked-low-energy"],
            ["pet", "applied"],
            ["sleep", "applied"],
          ]);
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Derived Hunger", () => {
  it("derives Hunger from baseline and elapsed system time", () => {
    withRuntime((dbPath) => {
      let now = new Date("2026-05-28T00:00:00.000Z");
      const runtime = createCompanionRuntime({ dbPath, clock: () => now });

      try {
        runtime.updateCompanionVitalsAndMood({ vitals: { hunger: 80 } });
        now = new Date("2026-05-28T03:00:00.000Z");

        expect(runtime.getCompanionRuntimeState().companion.vitals.hunger).toBe(77);
      } finally {
        runtime.close();
      }
    });
  });

  it("caps long offline Hunger decay", () => {
    withRuntime((dbPath) => {
      let now = new Date("2026-05-28T00:00:00.000Z");
      const runtime = createCompanionRuntime({ dbPath, clock: () => now });

      try {
        runtime.updateCompanionVitalsAndMood({ vitals: { hunger: 80 } });
        now = new Date("2026-06-01T00:00:00.000Z");

        expect(runtime.getCompanionRuntimeState().companion.vitals.hunger).toBe(60);
      } finally {
        runtime.close();
      }
    });
  });

  it("does not apply suspicious clock jumps blindly", () => {
    withRuntime((dbPath) => {
      let now = new Date("2026-05-28T00:00:00.000Z");
      const runtime = createCompanionRuntime({ dbPath, clock: () => now });

      try {
        runtime.updateCompanionVitalsAndMood({ vitals: { hunger: 80 } });
        now = new Date("2026-05-27T23:00:00.000Z");
        expect(runtime.getCompanionRuntimeState().companion.vitals.hunger).toBe(80);

        now = new Date("2026-07-15T00:00:00.000Z");
        expect(runtime.getCompanionRuntimeState().companion.vitals.hunger).toBe(80);
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Companion Energy behavior", () => {
  it("marks low energy as fatigue and dampens XP without erasing recognition", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        runtime.updateCompanionVitalsAndMood({
          vitals: { companionEnergy: 15, xp: 0, intimacy: 0 },
          mood: createMood("neutral"),
        });

        const work = runtime.applyWorkGrowth({ tokenCount: 1000, sourceId: "req-1" });

        expect(work.outcome).toBe("fatigued-dampened");
        expect(work.state.companion.mood).toBe("fatigued");
        expect(work.state.companion.vitals.xp).toBe(1);
        expect(work.state.companion.vitals.companionEnergy).toBe(14);
      } finally {
        runtime.close();
      }
    });
  });

  it("recovers Companion Energy during rest and keeps Sleep as a manual recovery path", () => {
    withRuntime((dbPath) => {
      let now = new Date("2026-05-28T00:00:00.000Z");
      const runtime = createCompanionRuntime({ dbPath, clock: () => now });

      try {
        runtime.updateCompanionVitalsAndMood({
          vitals: { companionEnergy: 20 },
          mood: createMood("fatigued"),
        });
        now = new Date("2026-05-28T04:00:00.000Z");

        const rested = runtime.applyRestRecovery();
        expect(rested.companion.vitals.companionEnergy).toBe(32);
        expect(rested.companion.mood).toBe("neutral");

        const slept = runtime.performCompanionInteraction("sleep");
        expect(slept.state.companion.vitals.companionEnergy).toBe(72);
        expect(slept.state.companion.mood).toBe("sleeping");
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Gateway Events to Growth Events", () => {
  it("converts successful Gateway traffic metadata into Companion Growth without Gateway owning state", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        runtime.updateCompanionVitalsAndMood({
          vitals: { xp: 0, companionEnergy: 100 },
        });

        const growth = runtime.applyGatewayTrafficGrowth({
          gatewayEventId: "gateway-success-1",
          outcome: "translated",
          inputTokens: 1000,
          outputTokens: 500,
        });

        expect(growth.outcome).toBe("applied");
        expect(growth.state.companion.vitals.xp).toBe(3);
        expect(growth.state.companion.vitals.companionEnergy).toBe(98);

        const [event] = runtime.listGrowthEvents();
        expect(event.sourceType).toBe("gateway-event");
        expect(event.sourceId).toBe("gateway-success-1");
        expect(event.growthRuleVersion).toBe("gateway-traffic-v1");
      } finally {
        runtime.close();
      }
    });
  });

  it("does not award default XP for failed Gateway traffic", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        const growth = runtime.applyGatewayTrafficGrowth({
          gatewayEventId: "gateway-failed-1",
          outcome: "unsupported-route",
          inputTokens: 1000,
          outputTokens: 500,
        });

        expect(growth.outcome).toBe("failed-no-xp");
        expect(growth.state.companion.vitals.xp).toBe(0);

        const [event] = runtime.listGrowthEvents();
        expect(event.sourceType).toBe("gateway-event");
        expect(event.sourceId).toBe("gateway-failed-1");
        expect(event.after.xp).toBe(0);
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Growth Profile parameters", () => {
  it("uses adjustable Growth Profile parameters for Gateway and Work Growth", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        runtime.updateGrowthProfile({
          name: "Focused coding",
          version: "focused-growth-v2",
          xpMultiplier: 2,
          energyCostMultiplier: 0.5,
          fatigueThreshold: 30,
          xpDampeningMultiplier: 0.25,
          maxXpPerEvent: 3,
          maxEnergyCostPerEvent: 2,
        });

        const gateway = runtime.applyGatewayTrafficGrowth({
          gatewayEventId: "gateway-profile-1",
          outcome: "translated",
          inputTokens: 4000,
          outputTokens: 1000,
        });

        expect(gateway.outcome).toBe("applied");
        expect(gateway.state.growthProfile.version).toBe("focused-growth-v2");
        expect(gateway.event.growthRuleVersion).toBe("focused-growth-v2");
        expect(gateway.state.companion.vitals.xp).toBe(3);
        expect(gateway.state.companion.vitals.companionEnergy).toBe(98);

        runtime.updateCompanionVitalsAndMood({
          vitals: {
            companionEnergy: 25,
            xp: 0,
          },
        });

        const work = runtime.applyWorkGrowth({
          tokenCount: 2000,
          sourceId: "work-profile-1",
        });

        expect(work.outcome).toBe("fatigued-dampened");
        expect(work.event.growthRuleVersion).toBe("focused-growth-v2");
        expect(work.state.companion.vitals.xp).toBe(1);
        expect(work.state.companion.mood).toBe("fatigued");
      } finally {
        runtime.close();
      }
    });
  });
});

describe("Soul and Affective State baseline", () => {
  it("updates internal affective state separately from Mood, Intimacy, and Pet Appearance", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        const before = runtime.getCompanionRuntimeState();
        const after = runtime.updateSoulAffectiveState({
          pleasure: 0.8,
          arousal: -0.4,
          dominance: 0.2,
          affectiveEnergy: -0.5,
        });

        expect(after.soul.id).toBe(before.soul.id);
        expect(after.soul.personaName).toBe(before.soul.personaName);
        expect(after.companion.vitals).toEqual(before.companion.vitals);
        expect(after.companion.mood).toBe(before.companion.mood);
        expect(after.companion.petAppearance).toEqual(before.companion.petAppearance);
        expect(after.soul.affectiveState).toEqual({
          pleasure: 0.8,
          arousal: -0.4,
          dominance: 0.2,
          affectiveEnergy: -0.5,
        });
      } finally {
        runtime.close();
      }
    });
  });

  it("updates persona baseline without changing Companion identity or Provider Profile", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        const before = runtime.getCompanionRuntimeState();
        const after = runtime.updateSoulPersona({ personaName: "Pairing Companion" });

        expect(after.companion.id).toBe(before.companion.id);
        expect(after.companion.soulId).toBe(before.companion.soulId);
        expect(after.providerProfile).toEqual(before.providerProfile);
        expect(after.soul.personaName).toBe("Pairing Companion");
      } finally {
        runtime.close();
      }
    });
  });
});

function withRuntime(assertions: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-runtime-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    assertions(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
