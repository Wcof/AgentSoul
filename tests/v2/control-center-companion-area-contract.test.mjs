import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readAllAreaSources } from "./helpers/areaSource.js";

const root = process.cwd();

describe("AgentSoul v2 Control Center Companion area", () => {
  it("exposes Companion Area rendering from local runtime snapshot data", () => {
    const source = readAllAreaSources(root);

    expect(source).toMatch(/Control Center Companion Area/);
    expect(source).toMatch(/renderControlCenterCompanionAreaViewModel/);
    expect(source).toMatch(/renderControlCenterCompanionArea/);
    expect(source).toMatch(/growthHistory/);
    expect(source).toMatch(/Growth Events/);
    expect(source).toMatch(/data-control-area="companion"/);
  });

  it("verifies UI coverage for vitals, mood, appearance, interactions, and growth history", () => {
    const appTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(appTest).toMatch(/Control Center Companion area/);
    expect(appTest).toMatch(/Mood/);
    expect(appTest).toMatch(/Pet Appearance/);
    expect(appTest).toMatch(/Growth Events/);
    expect(output).toMatch(/Control Center Companion area/);
  }, 120000);
});
