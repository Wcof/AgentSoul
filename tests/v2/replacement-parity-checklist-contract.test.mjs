import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AgentSoul v2 Replacement parity checklist", () => {
  it("defines behavior-based parity gates before legacy implementation deletion", () => {
    const checklistPath = join(
      process.cwd(),
      "docs",
      "v2",
      "replacement-parity-checklist.md",
    );
    const checklist = readFileSync(checklistPath, "utf8");

    for (const section of [
      "Companion/Pet",
      "Soul/Memory/Persona",
      "Gateway/Provider",
      "Audit/Costs",
      "Skills",
      "Sessions",
      "Safety",
      "Control Center",
      "MCP",
      "Install/Local-first Startup",
      "Export",
    ]) {
      assert.match(checklist, new RegExp(`## ${escapeRegExp(section)}`));
    }

    assert.match(checklist, /Delete legacy implementation: BLOCKED/);
    assert.match(checklist, /Product behavior, not old module parity/);
    assert.match(checklist, /Blocker before deletion/);
    assert.match(checklist, /#55/);
    assert.match(checklist, /#62/);
    assert.match(checklist, /tests\/v2\/mcp-adapter-contract\.test\.mjs/);
    assert.match(checklist, /tests\/v2\/user-managed-export-contract\.test\.mjs/);
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
