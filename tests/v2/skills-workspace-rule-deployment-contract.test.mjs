import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Workspace Rule Deployment", () => {
  it("exposes managed symlink/copy deployment, conflict approval, and owned cleanup boundaries", () => {
    const source = readFileSync(join(root, "packages", "skills", "src", "index.ts"), "utf8");

    assert.match(source, /deployWorkspaceRules/);
    assert.match(source, /listManagedRuleFiles/);
    assert.match(source, /cleanupWorkspaceRules/);
    assert.match(source, /symlinkSync/);
    assert.match(source, /copyFileSync/);
    assert.match(source, /managed_rule_files/);
    assert.match(source, /user-authored-file/);
    assert.match(source, /approval-required/);
  });

  it("verifies symlink, copy, conflict, and cleanup behavior", () => {
    const output = execFileSync("npm", ["run", "skills:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Workspace Rule Deployment/);
  });
});
