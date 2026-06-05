import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

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

  it("does not require a legacy Control Center Settings Area surface", () => {
    const desktopBodySource = readFileSync(join(root, "apps", "desktop-v2", "src", "desktop-body", "index.ts"), "utf8");
    const extensionRuntimeSource = readFileSync(join(root, "apps", "desktop-v2", "src", "extension-runtime", "index.ts"), "utf8");

    expect(desktopBodySource).toMatch(/bootstrapDesktopBody/);
    expect(extensionRuntimeSource).toMatch(/createExtensionRuntime/);
    expect(extensionRuntimeSource).not.toMatch(/data-control-area="settings-full"/);
  });

  it("verifies Growth Profile affects Gateway and Work Growth behavior", () => {
    const output = execFileSync("npm", ["run", "companion:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Growth Profile parameters/);
  });
});
