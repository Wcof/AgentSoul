import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Skill Source Store and Installation", () => {
  it("exposes Skill Installation without Project Skill Activation or Workspace Rule Deployment", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");
    const packageJson = readFileSync(join(root, "package.json"), "utf8");

    expect(packageJson).toMatch(/@agentsoul\/skills|skills:test/);
    expect(source).toMatch(/createSkillSourceStore/);
    expect(source).toMatch(/installSkillPack/);
    expect(source).toMatch(/importLocalSkillPack/);
    expect(source).toMatch(/listSkillPacks/);
    expect(source).toMatch(/SkillSourceMetadata/);
    expect(source).toMatch(/workspaceRuleDeploymentsCreated: false/);
  });

  it("verifies install, list, source metadata, and no-deploy behavior", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Skill Source Store and Installation/);
  });
});
