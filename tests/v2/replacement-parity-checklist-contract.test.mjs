import { describe, it, expect } from "vitest";
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
      expect(checklist).toMatch(new RegExp(`## ${escapeRegExp(section)}`));
    }

    expect(checklist).toMatch(/Delete legacy implementation: BLOCKED/);
    expect(checklist).toMatch(/Product behavior/);
    expect(checklist).toMatch(/Blocker before deletion/);
    expect(checklist).toMatch(/#55/);
    expect(checklist).toMatch(/#62/);
    expect(checklist).toMatch(/tests\/v2\/mcp-adapter-contract\.test\.mjs/);
    expect(checklist).toMatch(/tests\/v2\/user-managed-export-contract\.test\.mjs/);
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
