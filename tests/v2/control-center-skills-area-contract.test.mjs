import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Skills area", () => {
  it("exposes Skills Area rendering for installation, activation, and workspace deployment state", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "renderers.ts"), "utf8");

    expect(source).toMatch(/Control Center Skills Area/);
    expect(source).toMatch(/renderControlCenterSkillsAreaViewModel/);
    expect(source).toMatch(/renderControlCenterSkillsArea/);
    expect(source).toMatch(/data-control-area="skills"/);
    expect(source).toMatch(/data-skill-activation/);
    expect(source).toMatch(/data-safety-action/);
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

    expect(appTest).toMatch(/Skill Installation/);
    expect(appTest).toMatch(/Project Skill Activation/);
    expect(appTest).toMatch(/Workspace Rule Deployment/);
    expect(appTest).toMatch(/Managed Rule File/);
    expect(appTest).toMatch(/Safety Policy/);
    expect(output).toMatch(/Control Center Skills area/);
  }, 120000);
});
