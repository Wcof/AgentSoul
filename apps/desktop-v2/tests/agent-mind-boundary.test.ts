import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAgentMindPromptLayers,
  buildCompanionChatPayload,
  normalizeAutonomySnapshot,
  projectAutonomyRuntime,
  runCompanionInteractionTurn,
} from "../src/agent-mind";

const repoRoot = join(__dirname, "..", "..", "..");

describe("Agent Mind public seam", () => {
  it("owns interaction turns, prompt layers, and autonomy projection", () => {
    expect(runCompanionInteractionTurn).toBeTypeOf("function");
    expect(buildCompanionChatPayload).toBeTypeOf("function");
    expect(buildAgentMindPromptLayers).toBeTypeOf("function");
    expect(projectAutonomyRuntime).toBeTypeOf("function");
    expect(normalizeAutonomySnapshot).toBeTypeOf("function");
  });

  it("does not import old Control Center concepts", () => {
    const agentMindSource = readFileSync(
      join(repoRoot, "apps", "desktop-v2", "src", "agent-mind", "index.ts"),
      "utf8",
    );

    expect(agentMindSource).not.toMatch(/gateway|costs|sessions|mcp|prompts|safety|conversations/i);
  });
});
