import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("AgentSoul v2 MCP adapter", () => {
  it("exposes a v2 MCP adapter package and Companion status tool", () => {
    const source = readFileSync(
      join(process.cwd(), "packages", "mcp-adapter", "src", "index.ts"),
      "utf8",
    );

    assert.match(source, /createV2McpAdapter/);
    assert.match(source, /agentsoul_get_companion_status/);
    assert.match(source, /agentsoul_interact_companion/);
    assert.match(source, /agentsoul_request_controlled_action/);
    assert.match(source, /mcp_tool_index/);
    assert.match(source, /get_persona_config/);
    assert.match(source, /get_soul_state/);
    assert.match(source, /write_memory_day/);
    assert.match(source, /write_memory_topic/);
    assert.match(source, /list_memory_topics/);
    assert.match(source, /update_soul_state/);
    assert.match(source, /getCompanionRuntimeState/);
    assert.match(source, /performCompanionInteraction/);
    assert.match(source, /updateSoulAffectiveState/);
    assert.match(source, /controlledEntryPoint: "mcp-server"/);
    assert.match(source, /decideSafetyPolicy/);
  });

  it("verifies MCP adapter package tests and schema registration", () => {
    const output = execFileSync("npm", ["run", "mcp-adapter:test"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.match(output, /v2 MCP adapter/);
    assert.match(output, /Companion status tool/);
    assert.match(output, /Controlled MCP action Safety Policy/);
    assert.match(output, /startup persona, soul, base rules, and memory MCP tools/);
  });
});
