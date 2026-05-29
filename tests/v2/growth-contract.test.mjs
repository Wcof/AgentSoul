import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Companion Growth interactions", () => {
  it("exposes interaction behavior from the runtime package without old state dependencies", () => {
    const source = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");

    expect(source).toMatch(/performCompanionInteraction/);
    expect(source).toMatch(/listGrowthEvents/);
    expect(source).not.toMatch(/persona\\.ya?ml|src\/agentsoul\/config|python/i);
  });

  it("updates Runtime State and persists Growth Events for Feed, Play, Pet, and Sleep", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Companion Growth interactions/);
  });
});
