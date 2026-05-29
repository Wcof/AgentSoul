import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Workspace Rule Deployment", () => {
  it("exposes managed symlink/copy deployment, conflict approval, and owned cleanup boundaries", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");

    expect(source).toMatch(/deployWorkspaceRules/);
    expect(source).toMatch(/listManagedRuleFiles/);
    expect(source).toMatch(/cleanupWorkspaceRules/);
    expect(source).toMatch(/symlinkSync/);
    expect(source).toMatch(/copyFileSync/);
    expect(source).toMatch(/managed_rule_files/);
    expect(source).toMatch(/user-authored-file/);
    expect(source).toMatch(/approval-required/);
  });

  it("verifies symlink, copy, conflict, and cleanup behavior", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Workspace Rule Deployment/);
  });
});
