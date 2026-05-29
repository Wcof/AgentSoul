import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Project Skill Activation", () => {
  it("exposes project-scoped activation query behavior with Global Skill Default override", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");

    expect(source).toMatch(/setProjectSkillActivation/);
    expect(source).toMatch(/listProjectSkillActivations/);
    expect(source).toMatch(/getEffectiveSkillActivation/);
    expect(source).toMatch(/globalDefaultEnabled/);
    expect(source).toMatch(/source: "project"/);
    expect(source).toMatch(/source: "global-default"/);
    expect(source).toMatch(/workspaceRuleDeploymentsCreated: false/);
    expect(source).not.toMatch(/managed_rule_files.*INSERT/is);
  });

  it("verifies project precedence and install-vs-activate separation", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Project Skill Activation/);
  });
});
