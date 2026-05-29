import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Project Skill Activation", () => {
  it("exposes project-scoped activation query behavior with Global Skill Default override", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");

    assert.match(source, /setProjectSkillActivation/);
    assert.match(source, /listProjectSkillActivations/);
    assert.match(source, /getEffectiveSkillActivation/);
    assert.match(source, /globalDefaultEnabled/);
    assert.match(source, /source: "project"/);
    assert.match(source, /source: "global-default"/);
    assert.match(source, /workspaceRuleDeploymentsCreated: false/);
    assert.doesNotMatch(source, /managed_rule_files.*INSERT/is);
  });

  it("verifies project precedence and install-vs-activate separation", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Project Skill Activation/);
  });
});
