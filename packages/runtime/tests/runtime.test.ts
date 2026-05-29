import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

        assert.equal(state.companion.id, "active-companion");
        assert.equal(state.companion.soulId, state.soul.id);
        assert.equal(state.companion.vitals.level, 1);
        assert.equal(state.companion.vitals.companionEnergy, 100);
        assert.equal(state.companion.petAppearance.kind, "slime");
        assert.equal(state.providerProfile.activationMode, "gateway-route");
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

        assert.equal(state.companion.vitals.level, 2);
        assert.equal(state.companion.vitals.xp, 15);
        assert.equal(state.companion.vitals.companionEnergy, 76);
        assert.equal(state.companion.vitals.hunger, 64);
        assert.equal(state.companion.vitals.intimacy, 28);
        assert.equal(state.companion.mood, "positive");
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

        assert.equal(after.companion.id, before.companion.id);
        assert.equal(after.companion.soulId, before.companion.soulId);
        assert.deepEqual(after.soul, before.soul);
        assert.deepEqual(after.providerProfile, before.providerProfile);
        assert.deepEqual(after.companion.petAppearance, {
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
        assert.equal(feed.outcome, "applied");
        assert.equal(feed.state.companion.vitals.hunger, 80);
        assert.equal(feed.state.companion.vitals.intimacy, 15);

        const play = runtime.performCompanionInteraction("play");
        assert.equal(play.outcome, "applied");
        assert.equal(play.state.companion.vitals.companionEnergy, 10);
        assert.equal(play.state.companion.vitals.intimacy, 30);
        assert.equal(play.state.companion.vitals.xp, 15);
        assert.equal(play.state.companion.mood, "positive");

        const blockedPlay = runtime.performCompanionInteraction("play");
        assert.equal(blockedPlay.outcome, "blocked-low-energy");
        assert.equal(blockedPlay.state.companion.vitals.companionEnergy, 10);
        assert.equal(blockedPlay.state.companion.vitals.xp, 15);

        const pet = runtime.performCompanionInteraction("pet");
        assert.equal(pet.outcome, "applied");
        assert.equal(pet.state.companion.vitals.intimacy, 40);
        assert.equal(pet.state.companion.vitals.xp, 20);

        const sleep = runtime.performCompanionInteraction("sleep");
        assert.equal(sleep.outcome, "applied");
        assert.equal(sleep.state.companion.vitals.companionEnergy, 50);
        assert.equal(sleep.state.companion.mood, "sleeping");

        const events = runtime.listGrowthEvents();
        assert.deepEqual(
          events.map((event) => [event.interaction, event.outcome]),
          [
            ["feed", "applied"],
            ["play", "applied"],
            ["play", "blocked-low-energy"],
            ["pet", "applied"],
            ["sleep", "applied"],
          ],
        );
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

        assert.equal(runtime.getCompanionRuntimeState().companion.vitals.hunger, 77);
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

        assert.equal(runtime.getCompanionRuntimeState().companion.vitals.hunger, 60);
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
        assert.equal(runtime.getCompanionRuntimeState().companion.vitals.hunger, 80);

        now = new Date("2026-07-15T00:00:00.000Z");
        assert.equal(runtime.getCompanionRuntimeState().companion.vitals.hunger, 80);
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

        assert.equal(work.outcome, "fatigued-dampened");
        assert.equal(work.state.companion.mood, "fatigued");
        assert.equal(work.state.companion.vitals.xp, 1);
        assert.equal(work.state.companion.vitals.companionEnergy, 14);
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
        assert.equal(rested.companion.vitals.companionEnergy, 32);
        assert.equal(rested.companion.mood, "neutral");

        const slept = runtime.performCompanionInteraction("sleep");
        assert.equal(slept.state.companion.vitals.companionEnergy, 72);
        assert.equal(slept.state.companion.mood, "sleeping");
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

        assert.equal(growth.outcome, "applied");
        assert.equal(growth.state.companion.vitals.xp, 3);
        assert.equal(growth.state.companion.vitals.companionEnergy, 98);

        const [event] = runtime.listGrowthEvents();
        assert.equal(event.sourceType, "gateway-event");
        assert.equal(event.sourceId, "gateway-success-1");
        assert.equal(event.growthRuleVersion, "gateway-traffic-v1");
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

        assert.equal(growth.outcome, "failed-no-xp");
        assert.equal(growth.state.companion.vitals.xp, 0);

        const [event] = runtime.listGrowthEvents();
        assert.equal(event.sourceType, "gateway-event");
        assert.equal(event.sourceId, "gateway-failed-1");
        assert.equal(event.after.xp, 0);
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

        assert.equal(gateway.outcome, "applied");
        assert.equal(gateway.state.growthProfile.version, "focused-growth-v2");
        assert.equal(gateway.event.growthRuleVersion, "focused-growth-v2");
        assert.equal(gateway.state.companion.vitals.xp, 3);
        assert.equal(gateway.state.companion.vitals.companionEnergy, 98);

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

        assert.equal(work.outcome, "fatigued-dampened");
        assert.equal(work.event.growthRuleVersion, "focused-growth-v2");
        assert.equal(work.state.companion.vitals.xp, 1);
        assert.equal(work.state.companion.mood, "fatigued");
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

        assert.equal(after.soul.id, before.soul.id);
        assert.equal(after.soul.personaName, before.soul.personaName);
        assert.deepEqual(after.companion.vitals, before.companion.vitals);
        assert.equal(after.companion.mood, before.companion.mood);
        assert.deepEqual(after.companion.petAppearance, before.companion.petAppearance);
        assert.deepEqual(after.soul.affectiveState, {
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

        assert.equal(after.companion.id, before.companion.id);
        assert.equal(after.companion.soulId, before.companion.soulId);
        assert.deepEqual(after.providerProfile, before.providerProfile);
        assert.equal(after.soul.personaName, "Pairing Companion");
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
