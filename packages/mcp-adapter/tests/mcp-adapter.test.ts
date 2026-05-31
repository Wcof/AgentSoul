import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAffectiveEnergy,
  createCompanionEnergy,
  createIntimacy,
  createMood,
} from "@agentsoul/domain";
import type { CompanionRuntimeState } from "@agentsoul/companion";
import { createCompanionRuntime } from "@agentsoul/companion";
import { createMemoryStore } from "@agentsoul/memory";
import { createV2McpAdapter } from "@agentsoul/mcp-adapter";
import { decideSafetyPolicy } from "@agentsoul/safety";

describe("v2 MCP adapter", () => {
  it("registers and calls the Companion status tool", () => {
    const adapter = createV2McpAdapter({
      runtime: {
        getCompanionRuntimeState() {
          return state;
        },
        performCompanionInteraction(kind) {
          return {
            outcome: "applied",
            state,
            event: {
              id: `event:${kind}`,
              companionId: "active-companion",
              interaction: kind,
              outcome: "applied",
              sourceType: "direct-interaction",
              sourceId: `mcp:${kind}`,
              growthRuleVersion: "companion-interactions-v1",
              before: state.companion.vitals,
              after: state.companion.vitals,
              mood: state.companion.mood,
              occurredAt: "2026-05-29T00:00:00.000Z",
            },
          };
        },
      },
    });

    expect(adapter.listTools().map((tool) => tool.name).slice(0, 3)).toEqual([
        "agentsoul_get_companion_status",
        "agentsoul_interact_companion",
        "agentsoul_request_controlled_action",
      ]);

    const tools = adapter.listTools();
    expect(tools.find((tool) => tool.name === "agentsoul_interact_companion")?.inputSchema.required?.[0]).toBe("interaction");
    expect(tools.find((tool) => tool.name === "agentsoul_request_controlled_action")?.inputSchema
        .required).toEqual(["actionKind", "clientAuthorizationMode", "approvalSurfaceAvailable", "now"]);

    const result = adapter.callTool({
      name: "agentsoul_get_companion_status",
      arguments: {},
    });

    expect(result.content[0].type).toBe("json");
    expect(result.content[0].json).toEqual(state);
  });

  it("invokes supported Companion interactions through the Runtime service", () => {
    const calls: string[] = [];
    const adapter = createV2McpAdapter({
      runtime: {
        getCompanionRuntimeState() {
          return state;
        },
        performCompanionInteraction(kind) {
          calls.push(kind);
          return {
            outcome: "applied",
            state,
            event: {
              id: `event:${kind}`,
              companionId: "active-companion",
              interaction: kind,
              outcome: "applied",
              sourceType: "direct-interaction",
              sourceId: `mcp:${kind}`,
              growthRuleVersion: "companion-interactions-v1",
              before: state.companion.vitals,
              after: state.companion.vitals,
              mood: state.companion.mood,
              occurredAt: "2026-05-29T00:00:00.000Z",
            },
          };
        },
      },
    });

    const result = adapter.callTool({
      name: "agentsoul_interact_companion",
      arguments: {
        interaction: "feed",
      },
    });

    expect(calls).toEqual(["feed"]);
    expect(result.content[0].type).toBe("json");
    const interactionResult = result.content[0].json as {
      outcome: string;
      state: CompanionRuntimeState;
    };
    expect(interactionResult.outcome).toBe("applied");
    expect(interactionResult.state.companion.id).toBe("active-companion");
  });

  it("reads Companion status from the v2 Runtime State service", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });

      try {
        runtime.updateCompanionVitalsAndMood({
          vitals: {
            level: 3,
            xp: 42,
            companionEnergy: 77,
            hunger: 66,
            intimacy: 55,
          },
        });

        const adapter = createV2McpAdapter({ runtime });
        const result = adapter.callTool({
          name: "agentsoul_get_companion_status",
          arguments: {},
        });

        expect(result.content[0].type).toBe("json");
        const runtimeState = result.content[0].json as CompanionRuntimeState;

        expect(runtimeState.companion.id).toBe("active-companion");
        expect(runtimeState.companion.vitals.level).toBe(3);
        expect(runtimeState.companion.vitals.xp).toBe(42);
        expect(runtimeState.companion.vitals.companionEnergy).toBe(77);
        expect(runtimeState.companion.vitals.hunger).toBe(66);
        expect(runtimeState.companion.vitals.intimacy).toBe(55);
        expect(runtimeState.soul.personaName).toBe("Default Companion Soul");
        expect(runtimeState.providerProfile.activationMode).toBe("gateway-route");
      } finally {
        runtime.close();
      }
    });
  });

  it("gates high-risk MCP actions through Safety Policy as the mcp-server Controlled Entry Point", () => {
    const adapter = createV2McpAdapter({
      runtime: {
        getCompanionRuntimeState() {
          return state;
        },
        performCompanionInteraction(kind) {
          return {
            outcome: "applied",
            state,
            event: {
              id: `event:${kind}`,
              companionId: "active-companion",
              interaction: kind,
              outcome: "applied",
              sourceType: "direct-interaction",
              sourceId: `mcp:${kind}`,
              growthRuleVersion: "companion-interactions-v1",
              before: state.companion.vitals,
              after: state.companion.vitals,
              mood: state.companion.mood,
              occurredAt: "2026-05-29T00:00:00.000Z",
            },
          };
        },
      },
      decideSafetyPolicy,
    });

    const result = adapter.callTool({
      name: "agentsoul_request_controlled_action",
      arguments: {
        actionKind: "execute-command",
        target: "npm publish",
        projectPath: "/workspace/app",
        clientId: "claude-code",
        clientAuthorizationMode: "normal",
        approvalSurfaceAvailable: true,
        now: "2026-05-29T12:00:00.000Z",
      },
    });

    expect(result.content[0].type).toBe("json");
    const decision = result.content[0].json as {
      outcome: string;
      actionRiskClass: string;
      approvalRequest?: { id: string; actionRiskClass: string };
    };
    expect(decision.outcome).toBe("approval-required");
    expect(decision.actionRiskClass).toBe("high-risk");
    expect(decision.approvalRequest?.actionRiskClass).toBe("high-risk");
    expect(decision.approvalRequest?.id ?? "").toMatch(/^approval:execute-command:/);
  });

  it("provides v2 replacements for startup persona, soul, base rules, and memory MCP tools", () => {
    withRuntime((dbPath) => {
      const runtime = createCompanionRuntime({ dbPath });
      const memoryStore = createMemoryStore({ dbPath });
      const adapter = createV2McpAdapter({ runtime, memoryStore });

      try {
        expect([
            "mcp_tool_index",
            "get_persona_config",
            "get_soul_state",
            "get_base_rules",
            "get_mcp_usage_guide",
            "list_memory_topics",
            "write_memory_day",
            "write_memory_topic",
            "update_soul_state",
          ].every((toolName) => adapter.listTools().some((tool) => tool.name === toolName))).toEqual(true);

        const persona = adapter.callTool({ name: "get_persona_config", arguments: {} });
        expect(persona.content[0].type).toBe("json");
        expect((persona.content[0].json as { companion: { id: string }; soul: { personaName: string } })
            .companion.id).toBe("active-companion");

        const baseRules = adapter.callTool({
          name: "get_base_rules",
          arguments: { name: "memory_base" },
        });
        expect(baseRules.content[0].type).toBe("text");
        expect(baseRules.content[0].text).toMatch(/memory/i);

        const writeTopic = adapter.callTool({
          name: "write_memory_topic",
          arguments: {
            topic: "AgentSoul v2 rewrite",
            content: "MCP startup compatibility is now backed by v2 local storage.",
          },
        });
        expect(writeTopic.content[0].type).toBe("json");
        expect((writeTopic.content[0].json as { success: boolean }).success).toBe(true);

        adapter.callTool({
          name: "write_memory_day",
          arguments: {
            date: "2026-05-29",
            content: "Validated v2 MCP startup memory write path.",
          },
        });

        const topics = adapter.callTool({
          name: "list_memory_topics",
          arguments: { status: "active" },
        });
        expect(topics.content[0].type).toBe("json");
        expect((topics.content[0].json as { topics: Array<{ topic: string; status: string }> }).topics.map(
            (topic) => ({ topic: topic.topic, status: topic.status }),
          )).toEqual([{ topic: "AgentSoul v2 rewrite", status: "active" }]);

        const soul = adapter.callTool({
          name: "update_soul_state",
          arguments: {
            pleasure: 0.4,
            arousal: 0.2,
            dominance: 0.1,
            trigger: "startup compatibility test",
          },
        });
        expect(soul.content[0].type).toBe("json");
        expect((soul.content[0].json as { newState: { affectiveState: { pleasure: number } } }).newState
            .affectiveState.pleasure).toBe(0.4);

        const soulState = adapter.callTool({ name: "get_soul_state", arguments: {} });
        expect(soulState.content[0].type).toBe("json");
        expect((soulState.content[0].json as { affectiveState: { arousal: number } }).affectiveState
            .arousal).toBe(0.2);
      } finally {
        memoryStore.close();
        runtime.close();
      }
    });
  });
});

const state: CompanionRuntimeState = {
  companion: {
    id: "active-companion",
    displayName: "AgentSoul",
    soulId: "default-soul",
    petAppearance: {
      kind: "slime",
      skin: "default",
    },
    vitals: {
      level: 2,
      xp: 10,
      companionEnergy: createCompanionEnergy(80),
      hunger: 90,
      intimacy: createIntimacy(30),
    },
    mood: createMood("positive"),
  },
  soul: {
    id: "default-soul",
    personaName: "Default Companion Soul",
    affectiveState: {
      pleasure: 0.2,
      arousal: 0.1,
      dominance: 0,
      affectiveEnergy: createAffectiveEnergy(0.4),
    },
  },
  providerProfile: {
    id: "default-provider-profile",
    name: "Default Provider",
    activationMode: "gateway-route",
    clientProtocol: "claude-messages",
    providerProtocol: "anthropic",
    targetModel: "claude-sonnet",
    endpoint: "http://localhost:4315",
  },
  growthProfile: {
    id: "default-growth-profile",
    name: "Default Growth Profile",
    version: "gateway-traffic-v1",
    xpMultiplier: 1,
    energyCostMultiplier: 1,
    fatigueThreshold: 20,
    xpDampeningMultiplier: 0.25,
    maxXpPerEvent: 20,
    maxEnergyCostPerEvent: 10,
  },
};

function withRuntime(fn: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-mcp-adapter-"));
  try {
    fn(join(dir, "agentsoul.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
