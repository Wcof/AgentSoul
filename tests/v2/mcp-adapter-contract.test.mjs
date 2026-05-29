import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("AgentSoul v2 MCP adapter", () => {
  it("exposes a v2 MCP adapter package and Companion status tool", () => {
    const source = readFileSync(
      join(process.cwd(), "packages", "mcp-adapter", "src", "index.ts"),
      "utf8",
    );

    expect(source).toMatch(/createV2McpAdapter/);
    expect(source).toMatch(/agentsoul_get_companion_status/);
    expect(source).toMatch(/agentsoul_interact_companion/);
    expect(source).toMatch(/agentsoul_request_controlled_action/);
    expect(source).toMatch(/mcp_tool_index/);
    expect(source).toMatch(/get_persona_config/);
    expect(source).toMatch(/get_soul_state/);
    expect(source).toMatch(/write_memory_day/);
    expect(source).toMatch(/write_memory_topic/);
    expect(source).toMatch(/list_memory_topics/);
    expect(source).toMatch(/update_soul_state/);
    expect(source).toMatch(/getCompanionRuntimeState/);
    expect(source).toMatch(/performCompanionInteraction/);
    expect(source).toMatch(/updateSoulAffectiveState/);
    expect(source).toMatch(/controlledEntryPoint: "mcp-server"/);
    expect(source).toMatch(/decideSafetyPolicy/);
  });

  it("verifies MCP adapter package tests and schema registration", () => {
    const output = execFileSync("npm", ["run", "mcp-adapter:test"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(output).toMatch(/MCP adapter/);
    expect(output).toMatch(/Companion status tool/);
    expect(output).toMatch(/Controlled MCP action Safety Policy/);
    expect(output).toMatch(/startup persona/);
  });
});
