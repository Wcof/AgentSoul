import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readAllAreaSources } from "./helpers/areaSource.js";

const root = process.cwd();

describe("AgentSoul v2 Growth Profile", () => {
  it("exposes user-adjustable Growth Rule parameters in Runtime State", () => {
    const source = readFileSync(join(root, "packages", "companion", "src", "index.ts"), "utf8");

    expect(source).toMatch(/GrowthProfile/);
    expect(source).toMatch(/updateGrowthProfile/);
    expect(source).toMatch(/xpMultiplier/);
    expect(source).toMatch(/energyCostMultiplier/);
    expect(source).toMatch(/fatigueThreshold/);
    expect(source).toMatch(/maxXpPerEvent/);
    expect(source).toMatch(/maxEnergyCostPerEvent/);
  });

  it("surfaces Growth Profile parameters in the Control Center Settings Area", () => {
    const source = readAllAreaSources(root);

    expect(source).toMatch(/Growth Profile/);
    expect(source).toMatch(/XP multiplier/);
    expect(source).toMatch(/Fatigue threshold/);
    expect(source).toMatch(/Growth Cap/);
  });

  it("verifies Growth Profile affects Gateway and Work Growth behavior", () => {
    const output = execFileSync("npm", ["run", "companion:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Growth Profile parameters/);
  });
});
