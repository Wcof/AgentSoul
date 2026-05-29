import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Skills area", () => {
  it("exposes Skills Area rendering for installation, activation, and workspace deployment state", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Skills Area/);
    assert.match(source, /renderControlCenterSkillsAreaViewModel/);
    assert.match(source, /renderControlCenterSkillsArea/);
    assert.match(source, /data-control-area="skills"/);
    assert.match(source, /data-skill-activation/);
    assert.match(source, /data-safety-action/);
  });

  it("verifies Skill Installation, Project Skill Activation, Workspace Rule Deployment, Managed Rule File, and Safety Policy UI coverage", () => {
    const appTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(appTest, /Skill Installation/);
    assert.match(appTest, /Project Skill Activation/);
    assert.match(appTest, /Workspace Rule Deployment/);
    assert.match(appTest, /Managed Rule File/);
    assert.match(appTest, /Safety Policy/);
    assert.match(output, /Control Center Skills area/);
  });
});
