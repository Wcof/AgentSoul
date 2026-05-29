import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Growth Profile", () => {
  it("exposes user-adjustable Growth Rule parameters in Runtime State", () => {
    const source = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");

    assert.match(source, /GrowthProfile/);
    assert.match(source, /updateGrowthProfile/);
    assert.match(source, /xpMultiplier/);
    assert.match(source, /energyCostMultiplier/);
    assert.match(source, /fatigueThreshold/);
    assert.match(source, /maxXpPerEvent/);
    assert.match(source, /maxEnergyCostPerEvent/);
  });

  it("surfaces Growth Profile parameters in the Control Center Settings Area", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Growth Profile/);
    assert.match(source, /XP multiplier/);
    assert.match(source, /Fatigue threshold/);
    assert.match(source, /Growth Cap/);
  });

  it("verifies Growth Profile affects Gateway and Work Growth behavior", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Growth Profile parameters/);
  });
});
