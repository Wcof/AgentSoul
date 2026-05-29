import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Skill Source Store and Installation", () => {
  it("exposes Skill Installation without Project Skill Activation or Workspace Rule Deployment", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");
    const packageJson = readFileSync(join(root, "package.json"), "utf8");

    assert.match(packageJson, /@agentsoul\/skills|skills:test/);
    assert.match(source, /createSkillSourceStore/);
    assert.match(source, /installSkillPack/);
    assert.match(source, /importLocalSkillPack/);
    assert.match(source, /listSkillPacks/);
    assert.match(source, /SkillSourceMetadata/);
    assert.match(source, /workspaceRuleDeploymentsCreated: false/);
  });

  it("verifies install, list, source metadata, and no-deploy behavior", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Skill Source Store and Installation/);
  });
});
