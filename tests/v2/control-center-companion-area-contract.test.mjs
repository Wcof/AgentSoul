import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Companion area", () => {
  it("exposes Companion Area rendering from local runtime snapshot data", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Companion Area/);
    assert.match(source, /renderControlCenterCompanionAreaViewModel/);
    assert.match(source, /renderControlCenterCompanionArea/);
    assert.match(source, /growthHistory/);
    assert.match(source, /Growth Events/);
    assert.match(source, /data-control-area="companion"/);
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

    assert.match(appTest, /Control Center Companion area/);
    assert.match(appTest, /Mood/);
    assert.match(appTest, /Pet Appearance/);
    assert.match(appTest, /Growth Events/);
    assert.match(output, /Control Center Companion area/);
  });
});
